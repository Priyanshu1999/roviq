import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { I18nContent } from '@roviq/database';
import type { BillingInterval, FeatureLimits } from '@roviq/ee-billing-types';
import { EVENT_PATTERNS, type EventPattern } from '@roviq/nats-jetstream';
import { getRequestContext } from '@roviq/request-context';
import { billingError } from '../billing.errors';
import { PlanRepository } from '../repositories/plan.repository';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private readonly repo: PlanRepository,
    @Inject('BILLING_NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  private emitEvent(pattern: EventPattern, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  async listPlans(resellerId: string, params: { status?: string; first: number; after?: string }) {
    return this.repo.findByResellerId(resellerId, params);
  }

  async getPlan(resellerId: string, id: string) {
    const plan = await this.repo.findById(resellerId, id);
    if (!plan) billingError('PLAN_NOT_FOUND', 'Subscription plan not found');
    return plan;
  }

  async createPlan(
    resellerId: string,
    input: {
      name: I18nContent;
      description?: I18nContent;
      code: string;
      interval: BillingInterval;
      amount: bigint;
      currency?: string;
      trialDays?: number;
      entitlements: FeatureLimits;
      sortOrder?: number;
    },
  ) {
    // Validate amount is non-negative (0 = free plan, >0 = paid plan)
    if (input.amount < 0n) {
      billingError('PLAN_NOT_FOUND', 'Plan amount must be non-negative');
    }

    // Validate unique code per reseller (among non-deleted)
    const existing = await this.repo.findByCode(resellerId, input.code);
    if (existing) {
      billingError('PLAN_CODE_DUPLICATE', `Plan code "${input.code}" already exists`);
    }

    const { userId } = getRequestContext();

    const plan = await this.repo.create(resellerId, {
      resellerId,
      name: input.name,
      description: input.description,
      code: input.code,
      interval: input.interval,
      amount: input.amount,
      currency: input.currency ?? 'INR',
      trialDays: input.trialDays ?? 0,
      entitlements: input.entitlements,
      sortOrder: input.sortOrder ?? 0,
      createdBy: userId,
      updatedBy: userId,
    });

    this.emitEvent(EVENT_PATTERNS.BILLING.plan.created, { id: plan.id, name: plan.name });
    return plan;
  }

  async updatePlan(
    resellerId: string,
    id: string,
    input: {
      version: number;
      name?: I18nContent;
      description?: I18nContent;
      amount?: bigint;
      interval?: BillingInterval;
      /** Number of free trial days before billing starts (0 = no trial) */
      trialDays?: number;
      /** Display order in plan listing — lower numbers appear first */
      sortOrder?: number;
      entitlements?: FeatureLimits;
    },
  ) {
    const { version, ...data } = input;
    const plan = await this.repo.update(resellerId, id, data, version);
    this.emitEvent(EVENT_PATTERNS.BILLING.plan.updated, { id });
    return plan;
  }

  async archivePlan(resellerId: string, id: string) {
    const plan = await this.repo.archive(resellerId, id);
    this.emitEvent(EVENT_PATTERNS.BILLING.plan.archived, { id });
    return plan;
  }

  async restorePlan(resellerId: string, id: string) {
    const plan = await this.repo.restore(resellerId, id);
    this.emitEvent(EVENT_PATTERNS.BILLING.plan.restored, { id });
    return plan;
  }

  async deletePlan(resellerId: string, id: string) {
    await this.repo.softDelete(resellerId, id);
    this.emitEvent(EVENT_PATTERNS.BILLING.plan.deleted, { id });
  }
}
