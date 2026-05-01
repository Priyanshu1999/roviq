import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import type {
  AssignPlanResult,
  BillingDashboardModel,
  InvoiceModel,
  PaymentGatewayConfigModel,
  PaymentModel,
  SubscriptionModel,
  SubscriptionPlanModel,
} from '@roviq/graphql/generated';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SEED_IDS } from '../../../scripts/seed-ids';
import { E2ePingDocument } from './__generated__/graphql';
import { loginAsPlatformAdmin, loginAsReseller } from './helpers/auth';
import { gql } from './helpers/gql-client';
import { simulatePaymentWebhook } from './helpers/webhook';

/**
 * Billing E2E — migrated from e2e/api-gateway-e2e/hurl/billing/*.hurl (14 files).
 *
 * Covers plan CRUD, plan assignment, subscription lifecycle (pause/resume/cancel),
 * invoice generation, manual payment recording, refund, reseller dashboard, and
 * invoice listing. All flows run as the seeded reseller user against the running
 * api-gateway over HTTP.
 *
 * Schema notes (where Hurl files were stale vs. current GraphQL schema):
 * - `assignPlanToInstitute` takes only `{ tenantId, planId }` (no provider/customer fields).
 * - `cancelSubscription`/`pauseSubscription` take an `input` object with `subscriptionId`
 *   and optional `reason` — there is no `atCycleEnd` field.
 * - `resumeSubscription` takes a top-level `subscriptionId: ID!` argument.
 * - There is no `subscription(instituteId:)` query; the reseller-scoped equivalent
 *   is the `subscriptions(...)` list query.
 * - `assignPlanToInstitute` returns `AssignPlanResult { subscription, checkoutUrl }`.
 * - `recordManualPayment` returns the updated `InvoiceModel`, not a `PaymentModel`.
 */

// ---------------------------------------------------------------------------
// Reusable GraphQL operations
// ---------------------------------------------------------------------------

const CREATE_PLAN = `
  mutation CreatePlan($input: CreatePlanInput!) {
    createSubscriptionPlan(input: $input) {
      id
      name
      amount
      currency
      interval
      status
      entitlements
      version
    }
  }
`;

const UPDATE_PLAN = `
  mutation UpdatePlan($id: ID!, $input: UpdatePlanInput!) {
    updateSubscriptionPlan(id: $id, input: $input) {
      id
      name
      amount
      entitlements
      version
    }
  }
`;

const ARCHIVE_PLAN = `
  mutation ArchivePlan($id: ID!) {
    archivePlan(id: $id) { id status }
  }
`;

const RESTORE_PLAN = `
  mutation RestorePlan($id: ID!) {
    restorePlan(id: $id) { id status }
  }
`;

const DELETE_PLAN = `
  mutation DeletePlan($id: ID!) { deletePlan(id: $id) }
`;

const ASSIGN_PLAN = `
  mutation AssignPlan($input: AssignPlanInput!) {
    assignPlanToInstitute(input: $input) {
      subscription { id status tenantId planId }
      checkoutUrl
    }
  }
`;

const PAUSE_SUB = `
  mutation Pause($input: PauseSubscriptionInput!) {
    pauseSubscription(input: $input) { id status }
  }
`;

const RESUME_SUB = `
  mutation Resume($subscriptionId: ID!) {
    resumeSubscription(subscriptionId: $subscriptionId) { id status }
  }
`;

const CANCEL_SUB = `
  mutation Cancel($input: CancelSubscriptionInput!) {
    cancelSubscription(input: $input) { id status cancelledAt cancelReason }
  }
`;

const LIST_SUBS = `
  query Subs($status: String, $first: Int) {
    subscriptions(status: $status, first: $first) {
      id
      status
      tenantId
      planId
    }
  }
`;

const GENERATE_INVOICE = `
  mutation GenerateInvoice($input: GenerateInvoiceInput!) {
    generateInvoice(input: $input) {
      id
      invoiceNumber
      totalAmount
      status
    }
  }
`;

const RECORD_MANUAL_PAYMENT = `
  mutation RecordPayment($invoiceId: ID!, $input: ManualPaymentInput!) {
    recordManualPayment(invoiceId: $invoiceId, input: $input) {
      id
      status
    }
  }
`;

const ISSUE_REFUND = `
  mutation IssueRefund($paymentId: ID!, $input: RefundInput!) {
    issueRefund(paymentId: $paymentId, input: $input) { id status }
  }
`;

const LIST_INVOICES = `
  query Invoices($instituteId: ID, $first: Int) {
    invoices(instituteId: $instituteId, first: $first) {
      id
      invoiceNumber
      totalAmount
      status
      tenantId
    }
  }
`;

const RESELLER_DASHBOARD = `
  query {
    resellerBillingDashboard {
      mrr
      activeSubscriptions
      churnedLast30Days
      churnRate
      overdueInvoiceCount
      subscriptionsByStatus
    }
  }
`;

const LIST_GATEWAY_CONFIGS = `
  query {
    gatewayConfigs { id provider status }
  }
`;

const CREATE_GATEWAY_CONFIG = `
  mutation CreateGatewayConfig($input: CreateGatewayConfigInput!) {
    createGatewayConfig(input: $input) {
      id
      provider
      status
    }
  }
`;

const DELETE_GATEWAY_CONFIG = `
  mutation DeleteGatewayConfig($id: ID!) {
    deleteGatewayConfig(id: $id)
  }
`;

const GET_INVOICE = `
  query Invoice($instituteId: ID, $first: Int) {
    invoices(instituteId: $instituteId, first: $first) {
      id
      invoiceNumber
      status
      totalAmount
      tenantId
    }
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PlanInputOverrides {
  name?: string;
  amount?: string; // GraphQLBigInt is serialized as string over the wire
  code?: string;
  maxStudents?: number;
}

/**
 * Build a CreatePlanInput with sane defaults. `amount` is a string because
 * GraphQLBigInt is serialized as a JSON string over the wire.
 */
function buildPlanInput(overrides: PlanInputOverrides = {}) {
  const suffix = randomUUID().slice(0, 8);
  return {
    name: { en: overrides.name ?? `Vitest Plan ${suffix}` },
    description: { en: 'Created by billing.api-e2e.spec.ts' },
    amount: overrides.amount ?? '0',
    currency: 'INR',
    interval: 'MONTHLY',
    entitlements: {
      maxStudents: overrides.maxStudents ?? 5,
      maxStaff: 2,
      maxStorageMb: 512,
      auditLogRetentionDays: 30,
      features: [],
    },
    code: overrides.code ?? `VTEST-${suffix.toUpperCase()}`,
  };
}

async function createPlan(token: string, overrides: PlanInputOverrides = {}) {
  const res = await gql<{ createSubscriptionPlan: SubscriptionPlanModel }>(
    CREATE_PLAN,
    { input: buildPlanInput(overrides) },
    token,
  );
  if (res.errors?.length) {
    throw new Error(`createPlan failed: ${res.errors.map((e) => e.message).join(', ')}`);
  }
  assert(res.data);
  return res.data.createSubscriptionPlan;
}

/**
 * Cancel any existing active/paused subscription on `tenantId` so the test can
 * freshly assign a new plan. Hurl tests did this with `subscription(instituteId:)`,
 * which doesn't exist; we use the `subscriptions` list and filter client-side.
 */
async function cancelExistingSubscription(token: string, tenantId: string) {
  const res = await gql<{ subscriptions: SubscriptionModel[] }>(LIST_SUBS, { first: 100 }, token);
  if (res.errors?.length || !res.data) return;
  const subs = res.data.subscriptions ?? [];
  const target = subs.find(
    (s) => s.tenantId === tenantId && s.status !== 'CANCELLED' && s.status !== 'EXPIRED',
  );
  if (!target) return;
  await gql<{ cancelSubscription: SubscriptionModel }>(
    CANCEL_SUB,
    { input: { subscriptionId: target.id } },
    token,
  );
}

async function assignPlan(token: string, tenantId: string, planId: string) {
  const res = await gql<{ assignPlanToInstitute: AssignPlanResult }>(
    ASSIGN_PLAN,
    { input: { tenantId, planId } },
    token,
  );
  if (res.errors?.length) {
    throw new Error(`assignPlan failed: ${res.errors.map((e) => e.message).join(', ')}`);
  }
  assert(res.data);
  return res.data.assignPlanToInstitute;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Billing E2E', () => {
  let resellerToken: string;
  const tenant1 = SEED_IDS.INSTITUTE_1;
  const tenant2 = SEED_IDS.INSTITUTE_2;

  beforeAll(async () => {
    // Verify API reachable
    const ping = await gql(E2ePingDocument);
    expect(ping.data?.__typename).toBe('Query');

    const { accessToken } = await loginAsReseller();
    resellerToken = accessToken;
    expect(resellerToken).toBeTruthy();
  });

  // Billing tests cancel subscriptions which triggers BillingEventConsumer to
  // auto-suspend institutes. Restore both seeded institutes to ACTIVE so
  // downstream test files aren't affected.
  afterAll(async () => {
    const { accessToken: adminToken } = await loginAsPlatformAdmin();
    for (const id of [tenant1, tenant2]) {
      const statusRes = await gql<{ adminGetInstitute: { status: string } }>(
        `query Get($id: ID!) { adminGetInstitute(id: $id) { status } }`,
        { id },
        adminToken,
      );
      if (statusRes.data?.adminGetInstitute?.status !== 'ACTIVE') {
        await gql(
          `mutation Activate($id: ID!) { adminActivateInstitute(id: $id) { id } }`,
          { id },
          adminToken,
        );
      }
    }
  });

  // -------------------------------------------------------------------------
  // Plan CRUD (hurl 01, 02, 04)
  // -------------------------------------------------------------------------

  describe('Plan CRUD', () => {
    it('should create a subscription plan (hurl 01)', async () => {
      const input = buildPlanInput({
        name: 'Vitest Create Plan',
        amount: '49900',
        maxStudents: 50,
      });
      const res = await gql<{ createSubscriptionPlan: SubscriptionPlanModel }>(
        CREATE_PLAN,
        { input },
        resellerToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      const plan = res.data.createSubscriptionPlan;
      expect(plan.id).toBeTruthy();
      expect(plan.name.en).toBe('Vitest Create Plan');
      expect(plan.currency).toBe('INR');
      expect(plan.interval).toBe('MONTHLY');
      expect(plan.status).toBe('ACTIVE');
      expect(plan.entitlements.maxStudents).toBe(50);
    });

    it('should update an existing plan (hurl 02)', async () => {
      const created = await createPlan(resellerToken, {
        name: 'Vitest Update Source',
        amount: '10000',
        maxStudents: 10,
      });

      const res = await gql<{ updateSubscriptionPlan: SubscriptionPlanModel }>(
        UPDATE_PLAN,
        {
          id: created.id,
          input: {
            version: created.version,
            name: { en: 'Vitest Updated Plan' },
            amount: '29900',
            entitlements: {
              maxStudents: 50,
              maxStaff: 10,
              maxStorageMb: 10240,
              auditLogRetentionDays: 90,
              features: [],
            },
          },
        },
        resellerToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      const updated = res.data.updateSubscriptionPlan;
      expect(updated.id).toBe(created.id);
      expect(updated.name.en).toBe('Vitest Updated Plan');
      expect(updated.entitlements.maxStudents).toBe(50);
      expect(updated.entitlements.maxStorageMb).toBe(10240);
    });

    it('should archive, reject assignment of archived plan, restore, then delete (hurl 04)', async () => {
      const created = await createPlan(resellerToken, { name: 'Vitest Archive Plan' });

      // Archive
      const archived = await gql<{ archivePlan: SubscriptionPlanModel }>(
        ARCHIVE_PLAN,
        { id: created.id },
        resellerToken,
      );
      expect(archived.errors).toBeUndefined();
      assert(archived.data);
      expect(archived.data.archivePlan.status).toBe('INACTIVE');

      // Free up tenant2 so we can attempt the assignment
      await cancelExistingSubscription(resellerToken, tenant2);

      // Assigning an archived plan should fail
      const assignAttempt = await gql<{ assignPlanToInstitute: AssignPlanResult }>(
        ASSIGN_PLAN,
        { input: { tenantId: tenant2, planId: created.id } },
        resellerToken,
      );
      expect(assignAttempt.errors).toBeDefined();
      // Service throws billingError('PLAN_NOT_FOUND', 'Plan is not active')
      // — see ee/apps/api-gateway/src/billing/reseller/subscription.service.ts.
      expect(assignAttempt.errors?.[0].message).toMatch(/not active|inactive|archived/i);

      // Restore
      const restored = await gql<{ restorePlan: SubscriptionPlanModel }>(
        RESTORE_PLAN,
        { id: created.id },
        resellerToken,
      );
      expect(restored.errors).toBeUndefined();
      assert(restored.data);
      expect(restored.data.restorePlan.status).toBe('ACTIVE');

      // Soft-delete
      const deleted = await gql<{ deletePlan: boolean }>(
        DELETE_PLAN,
        { id: created.id },
        resellerToken,
      );
      expect(deleted.errors).toBeUndefined();
      assert(deleted.data);
      expect(deleted.data.deletePlan).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Plan assignment + duplicate-subscription (hurl 03, 05)
  // -------------------------------------------------------------------------

  describe('Plan assignment', () => {
    it('should assign a free plan to an institute (hurl 03)', async () => {
      await cancelExistingSubscription(resellerToken, tenant2);
      const plan = await createPlan(resellerToken, { name: 'Vitest Assign Plan' });

      const result = await assignPlan(resellerToken, tenant2, plan.id);
      expect(result.subscription.id).toBeTruthy();
      expect(result.subscription.status).toBe('ACTIVE');
      expect(result.subscription.tenantId).toBe(tenant2);
      expect(result.subscription.planId).toBe(plan.id);
      // Free plan → no gateway interaction → no checkout URL
      expect(result.checkoutUrl).toBeNull();
    });

    it('should reject a second active subscription on the same institute (hurl 05)', async () => {
      await cancelExistingSubscription(resellerToken, tenant2);
      const planA = await createPlan(resellerToken, { name: 'Vitest Dup A' });
      const planB = await createPlan(resellerToken, { name: 'Vitest Dup B' });

      const first = await assignPlan(resellerToken, tenant2, planA.id);
      expect(first.subscription.status).toBe('ACTIVE');

      const second = await gql<{ assignPlanToInstitute: AssignPlanResult }>(
        ASSIGN_PLAN,
        { input: { tenantId: tenant2, planId: planB.id } },
        resellerToken,
      );
      expect(second.errors).toBeDefined();
      expect(second.errors?.[0].message).toMatch(/already.*subscription|active subscription/i);
    });
  });

  // -------------------------------------------------------------------------
  // Subscription lifecycle (hurl 06, 07, 08, 09)
  // -------------------------------------------------------------------------

  describe('Subscription lifecycle', () => {
    it('should pause then resume an active subscription (hurl 06)', async () => {
      await cancelExistingSubscription(resellerToken, tenant1);
      const plan = await createPlan(resellerToken, { name: 'Vitest Lifecycle Plan' });
      const { subscription } = await assignPlan(resellerToken, tenant1, plan.id);

      const paused = await gql<{ pauseSubscription: SubscriptionModel }>(
        PAUSE_SUB,
        { input: { subscriptionId: subscription.id } },
        resellerToken,
      );
      expect(paused.errors).toBeUndefined();
      assert(paused.data);
      expect(paused.data.pauseSubscription.id).toBe(subscription.id);
      expect(paused.data.pauseSubscription.status).toBe('PAUSED');

      const resumed = await gql<{ resumeSubscription: SubscriptionModel }>(
        RESUME_SUB,
        { subscriptionId: subscription.id },
        resellerToken,
      );
      expect(resumed.errors).toBeUndefined();
      assert(resumed.data);
      expect(resumed.data.resumeSubscription.id).toBe(subscription.id);
      expect(resumed.data.resumeSubscription.status).toBe('ACTIVE');
    });

    it('should cancel a subscription and surface cancelledAt (hurl 07)', async () => {
      await cancelExistingSubscription(resellerToken, tenant2);
      const plan = await createPlan(resellerToken, { name: 'Vitest Cancel Plan' });
      const { subscription } = await assignPlan(resellerToken, tenant2, plan.id);

      const res = await gql<{ cancelSubscription: SubscriptionModel }>(
        CANCEL_SUB,
        { input: { subscriptionId: subscription.id, reason: 'e2e cancel test' } },
        resellerToken,
      );
      expect(res.errors).toBeUndefined();
      assert(res.data);
      // The current cancelSubscription mutation moves the subscription to a
      // terminal CANCELED state and sets cancelledAt. (Hurl's `atCycleEnd` flag
      // does not exist in the current schema.)
      expect(res.data.cancelSubscription.status).toBe('CANCELLED');
      expect(res.data.cancelSubscription.cancelledAt).not.toBeNull();
    });

    it('should reject cancelling an already-cancelled subscription (hurl 08)', async () => {
      await cancelExistingSubscription(resellerToken, tenant2);
      const plan = await createPlan(resellerToken, { name: 'Vitest Double Cancel Plan' });
      const { subscription } = await assignPlan(resellerToken, tenant2, plan.id);

      const first = await gql<{ cancelSubscription: SubscriptionModel }>(
        CANCEL_SUB,
        { input: { subscriptionId: subscription.id } },
        resellerToken,
      );
      expect(first.errors).toBeUndefined();
      assert(first.data);
      expect(first.data.cancelSubscription.status).toBe('CANCELLED');

      const second = await gql<{ cancelSubscription: SubscriptionModel }>(
        CANCEL_SUB,
        { input: { subscriptionId: subscription.id } },
        resellerToken,
      );
      expect(second.errors).toBeDefined();
      // Service throws assertTransition('CANCELLED', 'CANCELLED') →
      // "Cannot transition from CANCELLED to CANCELLED".
      expect(second.errors?.[0].message).toMatch(/cannot transition|already.*cancel/i);
    });

    it('should reject pause/resume in invalid states (hurl 09)', async () => {
      await cancelExistingSubscription(resellerToken, tenant2);
      const plan = await createPlan(resellerToken, { name: 'Vitest Invalid State Plan' });
      const { subscription } = await assignPlan(resellerToken, tenant2, plan.id);

      // Resume while ACTIVE → should fail. Service throws via assertTransition()
      // with message "Cannot transition from ACTIVE to ACTIVE".
      const badResume = await gql<{ resumeSubscription: SubscriptionModel }>(
        RESUME_SUB,
        { subscriptionId: subscription.id },
        resellerToken,
      );
      expect(badResume.errors).toBeDefined();
      expect(badResume.errors?.[0].message).toMatch(/cannot transition/i);

      // Pause it (valid)
      const paused = await gql<{ pauseSubscription: SubscriptionModel }>(
        PAUSE_SUB,
        { input: { subscriptionId: subscription.id } },
        resellerToken,
      );
      expect(paused.errors).toBeUndefined();
      assert(paused.data);
      expect(paused.data.pauseSubscription.status).toBe('PAUSED');

      // Pause again → should fail with "Cannot transition from PAUSED to PAUSED".
      const badPause = await gql<{ pauseSubscription: SubscriptionModel }>(
        PAUSE_SUB,
        { input: { subscriptionId: subscription.id } },
        resellerToken,
      );
      expect(badPause.errors).toBeDefined();
      expect(badPause.errors?.[0].message).toMatch(/cannot transition/i);
    });
  });

  // -------------------------------------------------------------------------
  // Invoice + payment (hurl 10, 11, 12, 14)
  // -------------------------------------------------------------------------

  describe('Invoices and payments', () => {
    it('should generate an invoice for a fresh subscription (hurl 10)', async () => {
      await cancelExistingSubscription(resellerToken, tenant1);
      const plan = await createPlan(resellerToken, {
        name: 'Vitest Invoice Plan',
        amount: '50000',
      });
      const { subscription } = await assignPlan(resellerToken, tenant1, plan.id);

      const res = await gql<{
        generateInvoice: Pick<InvoiceModel, 'id' | 'invoiceNumber' | 'totalAmount' | 'status'>;
      }>(
        GENERATE_INVOICE,
        { input: { tenantId: tenant1, subscriptionId: subscription.id } },
        resellerToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      const invoice = res.data.generateInvoice;
      expect(invoice.id).toBeTruthy();
      expect(invoice.invoiceNumber).toBeTruthy();
      // GraphQLBigInt's TS contract is `string | number` — graphql-scalars
      // serializes safe integers as JS numbers and switches to string only
      // for values exceeding Number.MAX_SAFE_INTEGER. Both are valid wire
      // formats; assert via Number() coercion (this is also the only safe
      // way to compare with literal expected values).
      expect(Number(invoice.totalAmount)).toBeGreaterThan(0);
      expect(invoice.status).toBe('SENT');
    });

    it('should record a manual cash payment against an invoice (hurl 11)', async () => {
      await cancelExistingSubscription(resellerToken, tenant2);
      const plan = await createPlan(resellerToken, {
        name: 'Vitest Payment Plan',
        amount: '100000',
      });
      const { subscription } = await assignPlan(resellerToken, tenant2, plan.id);

      const invoiceRes = await gql<{ generateInvoice: InvoiceModel }>(
        GENERATE_INVOICE,
        { input: { tenantId: tenant2, subscriptionId: subscription.id } },
        resellerToken,
      );
      expect(invoiceRes.errors).toBeUndefined();
      assert(invoiceRes.data);
      const invoice = invoiceRes.data.generateInvoice;

      const recordRes = await gql<{ recordManualPayment: InvoiceModel }>(
        RECORD_MANUAL_PAYMENT,
        {
          invoiceId: invoice.id,
          input: {
            method: 'CASH',
            amountPaise: invoice.totalAmount,
            receiptNumber: `VTEST-REC-${randomUUID().slice(0, 6)}`,
            notes: 'Vitest manual payment',
          },
        },
        resellerToken,
      );

      expect(recordRes.errors).toBeUndefined();
      assert(recordRes.data);
      expect(recordRes.data.recordManualPayment.id).toBe(invoice.id);
      expect(recordRes.data.recordManualPayment.status).toBeTruthy();
    });

    it('should list invoices for the reseller (hurl 14)', async () => {
      const res = await gql<{ invoices: InvoiceModel[] }>(
        LIST_INVOICES,
        { first: 10 },
        resellerToken,
      );
      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(Array.isArray(res.data.invoices)).toBe(true);
    });

    // hurl 12 — refund flow. The current `recordManualPayment` mutation
    // returns the updated InvoiceModel rather than a PaymentModel, so we
    // cannot capture a payment id directly the way the Hurl test did.
    // We assert that issueRefund rejects an obviously invalid paymentId,
    // exercising the resolver and CASL/scope guards end-to-end. The full
    // refund happy path is covered by integration tests in
    // ee/apps/api-gateway/src/billing/__tests__/.
    it('should reject issueRefund for an unknown payment id (hurl 12 — partial)', async () => {
      const res = await gql<{ issueRefund: PaymentModel }>(
        ISSUE_REFUND,
        {
          paymentId: '00000000-0000-4000-a000-0000000000ff',
          input: { amountPaise: '50000', reason: 'Vitest refund test' },
        },
        resellerToken,
      );
      expect(res.errors).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Reseller dashboard (hurl 13)
  // -------------------------------------------------------------------------

  describe('Reseller dashboard', () => {
    it('should return billing dashboard metrics (hurl 13)', async () => {
      const res = await gql<{ resellerBillingDashboard: BillingDashboardModel }>(
        RESELLER_DASHBOARD,
        undefined,
        resellerToken,
      );
      expect(res.errors).toBeUndefined();
      assert(res.data);
      const dashboard = res.data.resellerBillingDashboard;
      expect(dashboard).toBeDefined();
      expect(dashboard.activeSubscriptions).toBeGreaterThanOrEqual(0);
      expect(dashboard.overdueInvoiceCount).toBeGreaterThanOrEqual(0);
      expect(dashboard.churnedLast30Days).toBeGreaterThanOrEqual(0);
      expect(typeof dashboard.churnRate).toBe('number');
      expect(typeof dashboard.subscriptionsByStatus).toBe('object');
    });
  });

  // -------------------------------------------------------------------------
  // Payment gateway webhook (replaces the deleted paid/paid-assign-plan.hurl)
  //
  // Exercises the full gateway payment path: create a gateway config with known
  // credentials, assign a paid plan so an invoice is auto-generated, POST a
  // signed Razorpay webhook to `/api/webhooks/razorpay/:resellerId`, and assert
  // the invoice transitions to PAID. This is the only E2E test that exercises
  // the webhook controller → adapter.parseWebhook → PaymentService.handleWebhookPayment
  // path end-to-end over real HTTP.
  // -------------------------------------------------------------------------

  describe('Payment gateway webhook', () => {
    // Credentials baked into the created gateway config. `RAZORPAY_WEBHOOK_SECRET`
    // is what `RazorpayAdapter` will read via its decrypted credential config
    // (see ee/libs/backend/payments/src/factory/payment-gateway.factory.ts), so
    // the helper MUST sign with the same value.
    const WEBHOOK_SECRET = 'vitest-e2e-webhook-secret';
    const GATEWAY_CREDENTIALS = {
      RAZORPAY_KEY_ID: 'rzp_test_vitest',
      RAZORPAY_KEY_SECRET: 'vitest-key-secret',
      RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
    };

    let createdGatewayConfigId: string | null = null;

    afterAll(async () => {
      if (createdGatewayConfigId) {
        await gql<{ deleteGatewayConfig: boolean }>(
          DELETE_GATEWAY_CONFIG,
          { id: createdGatewayConfigId },
          resellerToken,
        );
        createdGatewayConfigId = null;
      }
    });

    async function ensureGatewayConfig(): Promise<void> {
      // Reuse config from a prior test in this describe block
      if (createdGatewayConfigId) return;

      // Idempotent: if a gateway config already exists (from a previous run),
      // leave it in place. A previous run's secret will not match — delete
      // and re-create with the known test secret.
      const listRes = await gql<{ gatewayConfigs: PaymentGatewayConfigModel[] }>(
        LIST_GATEWAY_CONFIGS,
        undefined,
        resellerToken,
      );
      const existing = listRes.data?.gatewayConfigs ?? [];
      for (const cfg of existing.filter((c) => c.provider === 'RAZORPAY')) {
        await gql<{ deleteGatewayConfig: boolean }>(
          DELETE_GATEWAY_CONFIG,
          { id: cfg.id },
          resellerToken,
        );
      }

      const createRes = await gql<{ createGatewayConfig: PaymentGatewayConfigModel }>(
        CREATE_GATEWAY_CONFIG,
        {
          input: {
            provider: 'RAZORPAY',
            displayName: 'Vitest E2E Razorpay',
            credentials: GATEWAY_CREDENTIALS,
            webhookSecret: WEBHOOK_SECRET,
            isDefault: true,
            testMode: true,
            supportedMethods: ['card', 'upi'],
          },
        },
        resellerToken,
      );
      if (createRes.errors?.length) {
        throw new Error(
          `createGatewayConfig failed: ${createRes.errors.map((e) => e.message).join(', ')}`,
        );
      }
      assert(createRes.data);
      createdGatewayConfigId = createRes.data.createGatewayConfig.id;
    }

    it('should mark invoice PAID after a signed Razorpay webhook', async () => {
      await ensureGatewayConfig();

      // Set up a paid plan and fresh subscription on tenant1. Cancel any
      // existing active sub so the assignment produces a fresh invoice.
      await cancelExistingSubscription(resellerToken, tenant1);
      const plan = await createPlan(resellerToken, {
        name: 'Vitest Webhook Plan',
        amount: '99900',
        maxStudents: 100,
      });
      const assignment = await assignPlan(resellerToken, tenant1, plan.id);
      expect(assignment.subscription.status).toBe('ACTIVE');

      // Pick the latest invoice for this tenant as the webhook target.
      const invoicesRes = await gql<{ invoices: InvoiceModel[] }>(
        GET_INVOICE,
        { instituteId: tenant1, first: 5 },
        resellerToken,
      );
      expect(invoicesRes.errors).toBeUndefined();
      const invoices = invoicesRes.data?.invoices ?? [];
      expect(invoices.length).toBeGreaterThan(0);
      const invoice = invoices[0];
      // assignPlan auto-generates an invoice for amount > 0 plans; its status
      // starts as ISSUED/SENT/OPEN depending on the mark-sent flow.
      expect(invoice.status).not.toBe('PAID');

      // POST the signed webhook. The reseller ID comes from the auth helper.
      const webhookRes = await simulatePaymentWebhook({
        resellerId: SEED_IDS.RESELLER_DIRECT,
        invoiceId: invoice.id,
        tenantId: tenant1,
        amountPaise: Number(invoice.totalAmount),
        status: 'captured',
        gatewayPaymentId: `pay_vitest_${Date.now()}`,
        webhookSecret: WEBHOOK_SECRET,
      });
      expect(
        webhookRes.status,
        `expected 200 from webhook, got ${webhookRes.status}: ${JSON.stringify(webhookRes.body)}`,
      ).toBe(200);

      // Re-query the invoice: PaymentService.handleWebhookPayment creates a
      // Payment row and calls invoiceService.markPaid, which transitions the
      // status to PAID.
      const afterRes = await gql<{ invoices: InvoiceModel[] }>(
        GET_INVOICE,
        { instituteId: tenant1, first: 5 },
        resellerToken,
      );
      const after = afterRes.data?.invoices ?? [];
      const updated = after.find((i) => i.id === invoice.id);
      expect(updated, `invoice ${invoice.id} disappeared after webhook`).toBeDefined();
      expect(updated?.status).toBe('PAID');
    });

    it('should reject a webhook with an invalid signature', async () => {
      await ensureGatewayConfig();

      // Any invoice ID — the adapter rejects the request on signature mismatch
      // before touching the DB.
      const webhookRes = await simulatePaymentWebhook({
        resellerId: SEED_IDS.RESELLER_DIRECT,
        invoiceId: '00000000-0000-4000-a000-000000000fff',
        tenantId: tenant1,
        amountPaise: 10000,
        status: 'captured',
        gatewayPaymentId: `pay_bad_${Date.now()}`,
        webhookSecret: 'wrong-secret-on-purpose',
      });

      // The controller returns 400 when signature verification throws.
      expect(webhookRes.status).toBe(400);
    });
  });
});
