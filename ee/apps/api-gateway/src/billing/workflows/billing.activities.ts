import { Logger } from '@nestjs/common';
import { type DrizzleDB, mkAdminCtx, withAdmin } from '@roviq/database';
import { BillingPeriod } from '@roviq/domain';
import type { BillingInterval } from '@roviq/ee-billing-types';
import { gatewayConfigs, invoices, payments, plans, subscriptions } from '@roviq/ee-database';
import { and, count, eq, gte, isNull, lt, lte } from 'drizzle-orm';

const logger = new Logger('BillingActivities');

/** 7-day grace period before past_due → cancelled */
const GRACE_PERIOD_DAYS = 7;
/** Invoice generated 7 days before period end */
const RENEWAL_LEAD_DAYS = 7;
/** Trial reminder 3 days before expiry */
const TRIAL_REMINDER_DAYS = 3;
/** Roviq Direct reseller ID for orphaned subscriptions */
const ROVIQ_DIRECT_ID = '00000000-0000-4000-a000-000000000011';

export interface BillingActivities {
  /** Find subscriptions nearing renewal and generate invoices */
  processRenewals(): Promise<{ processed: number; invoicesGenerated: number }>;
  /** Cancel past_due subscriptions that exceeded grace period */
  cancelGracePeriodExpired(): Promise<{ cancelled: number }>;
  /** Process trial expirations and reminders */
  processTrialExpiry(): Promise<{ expired: number; reminders: number }>;
  /** Mark overdue invoices */
  markOverdueInvoices(): Promise<{ marked: number }>;
  /** Clean up billing data when a reseller is deleted */
  cleanupResellerDeletion(resellerId: string): Promise<{
    subscriptionsTransferred: number;
    plansDeactivated: number;
    configsDeactivated: number;
  }>;
  /** Expire PENDING_VERIFICATION UPI payments past 24h deadline — full reversal */
  expireUpiVerifications(): Promise<{ expired: number }>;
}

export function createBillingActivities(db: DrizzleDB): BillingActivities {
  return {
    async processRenewals() {
      return withAdmin(db, mkAdminCtx(), async (tx) => {
        const now = new Date();
        const leadDate = new Date(now.getTime() + RENEWAL_LEAD_DAYS * 86_400_000);

        // Find active subscriptions nearing period end
        const rows = await tx
          .select({
            subscription: subscriptions,
            plan: plans,
          })
          .from(subscriptions)
          .innerJoin(plans, eq(subscriptions.planId, plans.id))
          .where(
            and(eq(subscriptions.status, 'ACTIVE'), lte(subscriptions.currentPeriodEnd, leadDate)),
          );

        let invoicesGenerated = 0;
        for (const row of rows) {
          const sub = row.subscription;
          const plan = row.plan;

          // Idempotent: check if invoice already exists for next period
          const nextPeriod = BillingPeriod.fromInterval(
            sub.currentPeriodEnd ?? now,
            plan.interval as BillingInterval,
          );
          const [existing] = await tx
            .select({ id: invoices.id })
            .from(invoices)
            .where(
              and(eq(invoices.subscriptionId, sub.id), eq(invoices.periodStart, nextPeriod.start)),
            )
            .limit(1);

          if (existing) continue;

          // Generate invoice
          const subtotal = Number(plan.amount);
          const tax = Math.round(subtotal * 0.18);
          const total = subtotal + tax;

          await tx.insert(invoices).values({
            tenantId: sub.tenantId,
            subscriptionId: sub.id,
            resellerId: sub.resellerId,
            invoiceNumber: `AUTO-${sub.id.slice(0, 8)}-${Date.now()}`,
            status: 'SENT',
            subtotalAmount: plan.amount,
            taxAmount: BigInt(tax),
            totalAmount: BigInt(total),
            paidAmount: 0n,
            currency: plan.currency,
            periodStart: nextPeriod.start,
            periodEnd: nextPeriod.end,
            issuedAt: now,
            dueAt: new Date(now.getTime() + 15 * 86_400_000),
            lineItems: [
              {
                description: `Subscription renewal`,
                quantity: 1,
                unitAmountPaise: String(subtotal),
                totalAmountPaise: String(subtotal),
                taxRate: 18,
                taxAmountPaise: String(tax),
                sacCode: '998393',
              },
            ],
            taxBreakdown: { gst: { rate: 18, amount: tax, sacCode: '998393' } },
            createdBy: 'SYSTEM',
            updatedBy: 'SYSTEM',
          });
          invoicesGenerated++;
        }

        logger.log(`Processed ${rows.length} renewals, generated ${invoicesGenerated} invoices`);
        return { processed: rows.length, invoicesGenerated };
      });
    },

    async cancelGracePeriodExpired() {
      return withAdmin(db, mkAdminCtx(), async (tx) => {
        const graceExpiry = new Date(Date.now() - GRACE_PERIOD_DAYS * 86_400_000);

        const result = await tx
          .update(subscriptions)
          .set({
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelReason: 'Grace period expired',
            updatedAt: new Date(),
            updatedBy: 'SYSTEM',
          })
          .where(
            and(eq(subscriptions.status, 'PAST_DUE'), lte(subscriptions.updatedAt, graceExpiry)),
          )
          .returning({ id: subscriptions.id });

        logger.log(`Cancelled ${result.length} subscriptions after grace period`);
        return { cancelled: result.length };
      });
    },

    async processTrialExpiry() {
      return withAdmin(db, mkAdminCtx(), async (tx) => {
        const now = new Date();
        const reminderDate = new Date(now.getTime() + TRIAL_REMINDER_DAYS * 86_400_000);

        // Expire trials past their end date
        const expired = await tx
          .update(subscriptions)
          .set({ status: 'EXPIRED', updatedAt: now, updatedBy: 'SYSTEM' })
          .where(and(eq(subscriptions.status, 'TRIALING'), lte(subscriptions.trialEndsAt, now)))
          .returning({ id: subscriptions.id });

        // Count trials needing reminder (3 days before expiry)
        const [{ reminderCount }] = await tx
          .select({ reminderCount: count() })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.status, 'TRIALING'),
              lte(subscriptions.trialEndsAt, reminderDate),
              gte(subscriptions.trialEndsAt, now),
            ),
          );

        logger.log(`Trial expiry: ${expired.length} expired, ${reminderCount} reminders`);
        return { expired: expired.length, reminders: reminderCount };
      });
    },

    async markOverdueInvoices() {
      return withAdmin(db, mkAdminCtx(), async (tx) => {
        const now = new Date();

        const result = await tx
          .update(invoices)
          .set({ status: 'OVERDUE', updatedAt: now, updatedBy: 'SYSTEM' })
          .where(and(eq(invoices.status, 'SENT'), lte(invoices.dueAt, now)))
          .returning({ id: invoices.id });

        logger.log(`Marked ${result.length} invoices as overdue`);
        return { marked: result.length };
      });
    },

    async cleanupResellerDeletion(resellerId: string) {
      return withAdmin(db, mkAdminCtx(), async (tx) => {
        // Transfer subscriptions to Roviq Direct
        const transferred = await tx
          .update(subscriptions)
          .set({ resellerId: ROVIQ_DIRECT_ID, updatedAt: new Date(), updatedBy: 'SYSTEM' })
          .where(eq(subscriptions.resellerId, resellerId))
          .returning({ id: subscriptions.id });

        // Deactivate plans
        const deactivated = await tx
          .update(plans)
          .set({ status: 'INACTIVE', updatedAt: new Date(), updatedBy: 'SYSTEM' })
          .where(and(eq(plans.resellerId, resellerId), isNull(plans.deletedAt)))
          .returning({ id: plans.id });

        // Deactivate gateway configs
        const configs = await tx
          .update(gatewayConfigs)
          .set({ status: 'INACTIVE', updatedAt: new Date(), updatedBy: 'SYSTEM' })
          .where(and(eq(gatewayConfigs.resellerId, resellerId), isNull(gatewayConfigs.deletedAt)))
          .returning({ id: gatewayConfigs.id });

        // Historical invoices retain original resellerId (audit trail)

        logger.log(
          `Reseller ${resellerId} cleanup: ${transferred.length} subs transferred, ${deactivated.length} plans deactivated, ${configs.length} configs deactivated`,
        );
        return {
          subscriptionsTransferred: transferred.length,
          plansDeactivated: deactivated.length,
          configsDeactivated: configs.length,
        };
      });
    },

    async expireUpiVerifications() {
      return withAdmin(db, mkAdminCtx(), async (tx) => {
        const now = new Date();

        // Find PENDING_VERIFICATION payments past their 24h deadline
        const expiredPayments = await tx
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.verificationStatus, 'PENDING_VERIFICATION'),
              lt(payments.verificationDeadline, now),
            ),
          );

        for (const payment of expiredPayments) {
          // 1. Mark payment as EXPIRED + FAILED
          await tx
            .update(payments)
            .set({
              status: 'FAILED',
              verificationStatus: 'EXPIRED',
              failedAt: now,
              failureReason: 'UPI verification expired after 24h',
              updatedAt: now,
              updatedBy: 'SYSTEM',
            })
            .where(eq(payments.id, payment.id));

          // 2. Revert invoice paidAmount
          const [invoice] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, payment.invoiceId))
            .limit(1);

          if (invoice) {
            const newPaid = BigInt(Number(invoice.paidAmount) - Number(payment.amountPaise));
            const clampedPaid = newPaid < 0n ? 0n : newPaid;
            const newStatus = clampedPaid <= 0n ? 'SENT' : 'PARTIALLY_PAID';

            await tx
              .update(invoices)
              .set({
                paidAmount: clampedPaid,
                status: newStatus,
                updatedAt: now,
                updatedBy: 'SYSTEM',
              })
              .where(eq(invoices.id, invoice.id));

            // 3. If subscription was reactivated by this payment, revert to PAST_DUE
            const [sub] = await tx
              .select()
              .from(subscriptions)
              .where(
                and(
                  eq(subscriptions.tenantId, payment.tenantId),
                  eq(subscriptions.status, 'ACTIVE'),
                ),
              )
              .limit(1);

            if (sub) {
              await tx
                .update(subscriptions)
                .set({ status: 'PAST_DUE', updatedAt: now, updatedBy: 'SYSTEM' })
                .where(eq(subscriptions.id, sub.id));

              logger.log(`Reverted subscription ${sub.id} to PAST_DUE after UPI expiry`);
            }
          }

          logger.log(`Expired UPI verification for payment ${payment.id}`);
        }

        logger.log(`Expired ${expiredPayments.length} UPI verifications`);
        return { expired: expiredPayments.length };
      });
    },
  };
}
