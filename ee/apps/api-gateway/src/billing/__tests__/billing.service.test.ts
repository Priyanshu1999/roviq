import { createMongoAbility } from '@casl/ability';
import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppAbility } from '@roviq/common-types';
import { requestContext } from '@roviq/common-types';
import { BillingInterval, PaymentProvider, SubscriptionStatus } from '@roviq/ee-billing-types';
import { PaymentGatewayError } from '@roviq/ee-payments';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BillingRepository } from '../billing.repository';
import { BillingService } from '../billing.service';

function createMockAbility(): AppAbility {
  return createMongoAbility<AppAbility>([]);
}

function createMockRepo() {
  return {
    createPlan: vi.fn(),
    updatePlan: vi.fn(),
    findAllPlans: vi.fn(),
    findPlanById: vi.fn(),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    updateSubscriptionWithPlan: vi.fn(),
    findSubscriptionById: vi.fn(),
    findSubscriptionByInstitute: vi.fn(),
    findSubscriptionByProviderId: vi.fn(),
    findAllSubscriptions: vi.fn(),
    createInvoice: vi.fn(),
    findInvoiceByGatewayPaymentId: vi.fn(),
    findInvoices: vi.fn(),
    upsertGatewayConfig: vi.fn(),
    findInstituteById: vi.fn(),
    findAllInstitutes: vi.fn(),
    archivePlan: vi.fn(),
    restorePlan: vi.fn(),
    findPlanWithSubscriptionCount: vi.fn(),
    findPaymentByGatewayId: vi.fn(),
    createPayment: vi.fn(),
    claimPaymentEvent: vi.fn(),
    markPaymentSucceeded: vi.fn(),
  } satisfies Record<keyof BillingRepository, ReturnType<typeof vi.fn>>;
}

function createMockNatsClient() {
  return {
    emit: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    send: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
  };
}

function createMockGatewayFactory() {
  const mockGateway = {
    createPlan: vi.fn(),
    createSubscription: vi.fn(),
    cancelSubscription: vi.fn(),
    pauseSubscription: vi.fn(),
    resumeSubscription: vi.fn(),
  };
  return {
    getForProvider: vi.fn().mockReturnValue(mockGateway),
    getForInstitute: vi.fn().mockResolvedValue(mockGateway),
    _mockGateway: mockGateway,
  };
}

const TEST_CTX = {
  tenantId: 'test-tenant',
  userId: 'test-user',
  scope: 'institute' as const,
  impersonatorId: null,
  correlationId: 'test-corr',
};

describe('BillingService', () => {
  let service: BillingService;
  let repo: ReturnType<typeof createMockRepo>;
  let natsClient: ReturnType<typeof createMockNatsClient>;
  let factory: ReturnType<typeof createMockGatewayFactory>;
  const config = {
    get: vi.fn().mockReturnValue('http://localhost:3000'),
    getOrThrow: vi.fn().mockReturnValue('http://localhost:3000'),
  } as unknown as ConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockRepo();
    natsClient = createMockNatsClient();
    factory = createMockGatewayFactory();
    // Default: no existing invoice — allows invoice creation in webhook tests
    repo.findInvoiceByGatewayPaymentId.mockResolvedValue(null);
    service = new BillingService(
      repo as unknown as BillingRepository,
      natsClient as unknown as BillingService['natsClient'],
      {} as BillingService['db'],
      factory as unknown as BillingService['gatewayFactory'],
      config,
    );
  });

  // ---------------------------------------------------------------------------
  // createPlan
  // ---------------------------------------------------------------------------

  describe('createPlan', () => {
    it('should create a subscription plan and emit event', () =>
      requestContext.run(TEST_CTX, async () => {
        const input = {
          name: { en: 'Pro' },
          amount: 99900n,
          currency: 'INR',
          interval: BillingInterval.MONTHLY,
          entitlements: {
            maxStudents: 100,
            maxStaff: null,
            maxStorageMb: null,
            auditLogRetentionDays: 90,
            features: [],
          },
          resellerId: 'reseller-1',
          code: 'PRO',
        };
        repo.createPlan.mockResolvedValue({ id: 'plan-1', ...input });

        const result = await service.createPlan(input);

        expect(repo.createPlan).toHaveBeenCalledWith(
          expect.objectContaining({
            name: { en: 'Pro' },
            entitlements: expect.objectContaining({ maxStudents: 100 }),
            createdBy: TEST_CTX.userId,
            updatedBy: TEST_CTX.userId,
          }),
        );
        expect(result.id).toBe('plan-1');
        expect(natsClient.emit).toHaveBeenCalledWith('BILLING.plan.created', {
          id: 'plan-1',
          name: { en: 'Pro' },
        });
      }));

    it('should pass featureLimits object to repo', () =>
      requestContext.run(TEST_CTX, async () => {
        const input = {
          name: { en: 'Starter' },
          amount: 49900n,
          currency: 'INR',
          interval: BillingInterval.ANNUAL,
          entitlements: {
            maxStudents: 10,
            maxStaff: null,
            maxStorageMb: 5120,
            auditLogRetentionDays: 90,
            features: [],
          },
          resellerId: 'reseller-1',
          code: 'STARTER',
        };
        repo.createPlan.mockResolvedValue({ id: 'plan-2', name: { en: 'Starter' } });

        await service.createPlan(input);

        expect(repo.createPlan).toHaveBeenCalledWith(
          expect.objectContaining({
            entitlements: expect.objectContaining({ maxStudents: 10, maxStorageMb: 5120 }),
          }),
        );
      }));
  });

  // ---------------------------------------------------------------------------
  // updatePlan
  // ---------------------------------------------------------------------------

  describe('updatePlan', () => {
    it('should update a plan and emit event', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.updatePlan.mockResolvedValue({ id: 'plan-1', name: { en: 'Pro Plus' } });

        await service.updatePlan('plan-1', { name: { en: 'Pro Plus' } });

        expect(repo.updatePlan).toHaveBeenCalledWith(
          'plan-1',
          expect.objectContaining({ name: { en: 'Pro Plus' } }),
        );
        expect(natsClient.emit).toHaveBeenCalledWith('BILLING.plan.updated', { id: 'plan-1' });
      }));

    it('should only include defined fields in the update', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.updatePlan.mockResolvedValue({ id: 'plan-1' });

        await service.updatePlan('plan-1', { name: { en: 'Updated' }, amount: undefined });

        const updateData = repo.updatePlan.mock.calls[0][1];
        expect(updateData).toEqual({ name: { en: 'Updated' } });
        expect(updateData).not.toHaveProperty('amount');
      }));

    it('should pass featureLimits object in update', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.updatePlan.mockResolvedValue({ id: 'plan-1' });

        await service.updatePlan('plan-1', {
          entitlements: {
            maxStudents: 200,
            maxStaff: null,
            maxStorageMb: null,
            auditLogRetentionDays: 90,
            features: [],
          },
        });

        expect(repo.updatePlan).toHaveBeenCalledWith(
          'plan-1',
          expect.objectContaining({ entitlements: expect.objectContaining({ maxStudents: 200 }) }),
        );
      }));
  });

  // ---------------------------------------------------------------------------
  // archivePlan
  // ---------------------------------------------------------------------------

  describe('archivePlan', () => {
    it('should archive a plan with no active subscriptions', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findPlanById.mockResolvedValue({ id: 'plan-1', status: 'ACTIVE' });
        repo.findPlanWithSubscriptionCount.mockResolvedValue({ activeSubscriptionCount: 0 });
        repo.archivePlan.mockResolvedValue({ id: 'plan-1', status: 'INACTIVE' });

        const result = await service.archivePlan('plan-1');

        expect(result.status).toBe('INACTIVE');
        expect(repo.archivePlan).toHaveBeenCalledWith('plan-1');
        expect(natsClient.emit).toHaveBeenCalledWith('BILLING.plan.archived', { id: 'plan-1' });
      }));

    it('should reject archiving a plan with active subscriptions', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findPlanById.mockResolvedValue({ id: 'plan-1', status: 'ACTIVE' });
        repo.findPlanWithSubscriptionCount.mockResolvedValue({ activeSubscriptionCount: 3 });

        await expect(service.archivePlan('plan-1')).rejects.toThrow(BadRequestException);
        expect(repo.archivePlan).not.toHaveBeenCalled();
      }));

    it('should throw NotFoundException for non-existent plan', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findPlanById.mockResolvedValue(null);

        await expect(service.archivePlan('plan-999')).rejects.toThrow(
          'Subscription plan not found',
        );
      }));
  });

  // ---------------------------------------------------------------------------
  // restorePlan
  // ---------------------------------------------------------------------------

  describe('restorePlan', () => {
    it('should restore an archived plan', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findPlanById.mockResolvedValue({ id: 'plan-1', status: 'INACTIVE' });
        repo.restorePlan.mockResolvedValue({ id: 'plan-1', status: 'ACTIVE' });

        const result = await service.restorePlan('plan-1');

        expect(result.status).toBe('ACTIVE');
        expect(repo.restorePlan).toHaveBeenCalledWith('plan-1');
        expect(natsClient.emit).toHaveBeenCalledWith('BILLING.plan.restored', { id: 'plan-1' });
      }));

    it('should reject restoring a non-archived plan', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findPlanById.mockResolvedValue({ id: 'plan-1', status: 'ACTIVE' });

        await expect(service.restorePlan('plan-1')).rejects.toThrow(BadRequestException);
        expect(repo.restorePlan).not.toHaveBeenCalled();
      }));
  });

  // ---------------------------------------------------------------------------
  // findAllPlans
  // ---------------------------------------------------------------------------

  describe('findAllPlans', () => {
    it('should pass ability to repo', () =>
      requestContext.run(TEST_CTX, async () => {
        const mockAbility = createMockAbility();
        repo.findAllPlans.mockResolvedValue([]);

        await service.findAllPlans(mockAbility);

        expect(repo.findAllPlans).toHaveBeenCalledWith(mockAbility);
      }));

    it('should work without ability (admin)', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findAllPlans.mockResolvedValue([{ id: 'plan-1' }]);

        const result = await service.findAllPlans();

        expect(repo.findAllPlans).toHaveBeenCalledWith(undefined);
        expect(result).toHaveLength(1);
      }));
  });

  // ---------------------------------------------------------------------------
  // assignPlanToInstitute
  // ---------------------------------------------------------------------------

  describe('assignPlanToInstitute', () => {
    it('should reject archived plans', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findPlanById.mockResolvedValue({
          id: 'plan-1',
          status: 'INACTIVE',
          amount: 99900n,
        });

        await expect(
          service.assignPlanToInstitute({
            tenantId: 'institute-1',
            resellerId: 'reseller-1',
            planId: 'plan-1',
            provider: PaymentProvider.RAZORPAY,
            customerEmail: 'billing@demo.com',
            customerPhone: '9876543210',
          }),
        ).rejects.toThrow(BadRequestException);
      }));

    it('should reject institute with existing active subscription', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByInstitute.mockResolvedValue({
          id: 'sub-existing',
          status: 'ACTIVE',
        });

        await expect(
          service.assignPlanToInstitute({
            tenantId: 'institute-1',
            resellerId: 'reseller-1',
            planId: 'plan-1',
            provider: PaymentProvider.RAZORPAY,
            customerEmail: 'billing@demo.com',
            customerPhone: '9876543210',
          }),
        ).rejects.toThrow(BadRequestException);
      }));

    it('should create provider plan, subscription, gateway config, and emit event', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findPlanById.mockResolvedValue({
          id: 'plan-1',
          name: { en: 'Pro' },
          amount: 99900n,
          currency: 'INR',
          interval: 'MONTHLY',
          status: 'ACTIVE',
          resellerId: 'reseller-1',
        });
        repo.findInstituteById.mockResolvedValue({
          id: 'institute-1',
          name: { en: 'Demo' },
          slug: 'demo',
        });
        factory._mockGateway.createPlan.mockResolvedValue({ providerPlanId: 'rzp_plan_1' });
        factory._mockGateway.createSubscription.mockResolvedValue({
          providerSubscriptionId: 'rzp_sub_1',
          checkoutUrl: 'https://checkout.url',
        });
        repo.upsertGatewayConfig.mockResolvedValue({});
        repo.createSubscription.mockResolvedValue({ id: 'sub-1' });

        const result = await service.assignPlanToInstitute({
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
          planId: 'plan-1',
          provider: PaymentProvider.RAZORPAY,
          customerEmail: 'billing@demo.com',
          customerPhone: '9876543210',
        });

        expect(result.checkoutUrl).toBe('https://checkout.url');
        expect(factory.getForProvider).toHaveBeenCalledWith('RAZORPAY');
        expect(factory._mockGateway.createSubscription).toHaveBeenCalledWith(
          expect.objectContaining({
            customer: { name: 'Demo', email: 'billing@demo.com', phone: '9876543210' },
          }),
        );
        expect(repo.upsertGatewayConfig).toHaveBeenCalledWith('reseller-1', 'RAZORPAY');
        expect(repo.createSubscription).toHaveBeenCalledWith(
          expect.objectContaining({
            tenantId: 'institute-1',
            resellerId: 'reseller-1',
            planId: 'plan-1',
            status: 'ACTIVE',
            gatewaySubscriptionId: 'rzp_sub_1',
            gatewayProvider: 'RAZORPAY',
            createdBy: TEST_CTX.userId,
            updatedBy: TEST_CTX.userId,
          }),
        );
        expect(natsClient.emit).toHaveBeenCalledWith('BILLING.subscription.created', {
          subscriptionId: 'sub-1',
          tenantId: 'institute-1',
        });
      }));
  });

  // ---------------------------------------------------------------------------
  // cancelSubscription
  // ---------------------------------------------------------------------------

  describe('cancelSubscription', () => {
    it('should cancel at cycle end — keep status, record cancelledAt', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'ACTIVE',
          gatewaySubscriptionId: 'rzp_sub_1',
        });
        repo.updateSubscription.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

        await service.cancelSubscription('sub-1', true);

        expect(factory._mockGateway.cancelSubscription).toHaveBeenCalledWith('rzp_sub_1', true);
        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', {
          cancelledAt: expect.any(Date),
        });
        expect(natsClient.emit).toHaveBeenCalledWith('BILLING.subscription.cancelled', {
          subscriptionId: 'sub-1',
        });
      }));

    it('should cancel immediately — set status to CANCELED', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'ACTIVE',
          gatewaySubscriptionId: 'rzp_sub_1',
        });
        repo.updateSubscription.mockResolvedValue({ id: 'sub-1', status: 'CANCELLED' });

        await service.cancelSubscription('sub-1', false);

        expect(factory._mockGateway.cancelSubscription).toHaveBeenCalledWith('rzp_sub_1', false);
        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', {
          status: 'CANCELLED',
          cancelledAt: expect.any(Date),
        });
      }));

    it('should reject already canceled subscriptions', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          status: 'CANCELLED',
          gatewaySubscriptionId: 'rzp_sub_1',
        });

        await expect(service.cancelSubscription('sub-1')).rejects.toThrow(BadRequestException);
      }));

    it('should reject completed subscriptions', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          status: 'EXPIRED',
          gatewaySubscriptionId: 'rzp_sub_1',
        });

        await expect(service.cancelSubscription('sub-1')).rejects.toThrow(BadRequestException);
      }));

    it('should cancel without gateway call when no provider link (free plan)', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'ACTIVE',
          gatewaySubscriptionId: null,
        });
        repo.updateSubscription.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

        await service.cancelSubscription('sub-1', true);

        expect(factory._mockGateway.cancelSubscription).not.toHaveBeenCalled();
        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', {
          cancelledAt: expect.any(Date),
        });
      }));

    it('should throw BadGatewayException when provider cancel fails', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'ACTIVE',
          gatewaySubscriptionId: 'rzp_sub_1',
        });
        factory._mockGateway.cancelSubscription.mockRejectedValue(
          new PaymentGatewayError('Network error', 'RAZORPAY'),
        );

        await expect(service.cancelSubscription('sub-1')).rejects.toThrow(BadGatewayException);
        expect(repo.updateSubscription).not.toHaveBeenCalled();
      }));
  });

  // ---------------------------------------------------------------------------
  // pauseSubscription
  // ---------------------------------------------------------------------------

  describe('pauseSubscription', () => {
    it('should reject non-active subscriptions', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          status: 'PAUSED',
          gatewaySubscriptionId: 'rzp_sub_1',
        });

        await expect(service.pauseSubscription('sub-1')).rejects.toThrow(BadRequestException);
      }));

    it('should pause via provider, update DB status, and emit event', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'ACTIVE',
          gatewaySubscriptionId: 'rzp_sub_1',
        });
        repo.updateSubscription.mockResolvedValue({ id: 'sub-1', status: 'PAUSED' });

        await service.pauseSubscription('sub-1');

        expect(factory._mockGateway.pauseSubscription).toHaveBeenCalledWith('rzp_sub_1');
        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', { status: 'PAUSED' });
        expect(natsClient.emit).toHaveBeenCalledWith('BILLING.subscription.paused', {
          subscriptionId: 'sub-1',
        });
      }));

    it('should pause without gateway call when no provider link (free plan)', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'ACTIVE',
          gatewaySubscriptionId: null,
        });
        repo.updateSubscription.mockResolvedValue({ id: 'sub-1', status: 'PAUSED' });

        await service.pauseSubscription('sub-1');

        expect(factory._mockGateway.pauseSubscription).not.toHaveBeenCalled();
        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', { status: 'PAUSED' });
      }));

    it('should throw BadGatewayException when provider pause fails', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'ACTIVE',
          gatewaySubscriptionId: 'rzp_sub_1',
        });
        factory._mockGateway.pauseSubscription.mockRejectedValue(
          new PaymentGatewayError('Network error', 'RAZORPAY'),
        );

        await expect(service.pauseSubscription('sub-1')).rejects.toThrow(BadGatewayException);
        expect(repo.updateSubscription).not.toHaveBeenCalled();
      }));
  });

  // ---------------------------------------------------------------------------
  // resumeSubscription
  // ---------------------------------------------------------------------------

  describe('resumeSubscription', () => {
    it('should reject non-paused subscriptions', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          status: 'ACTIVE',
          gatewaySubscriptionId: 'rzp_sub_1',
        });

        await expect(service.resumeSubscription('sub-1')).rejects.toThrow(BadRequestException);
      }));

    it('should resume via provider, update DB status, and emit event', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'PAUSED',
          gatewaySubscriptionId: 'rzp_sub_1',
        });
        repo.updateSubscription.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

        await service.resumeSubscription('sub-1');

        expect(factory._mockGateway.resumeSubscription).toHaveBeenCalledWith('rzp_sub_1');
        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', { status: 'ACTIVE' });
        expect(natsClient.emit).toHaveBeenCalledWith('BILLING.subscription.resumed', {
          subscriptionId: 'sub-1',
        });
      }));

    it('should resume without gateway call when no provider link (free plan)', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'PAUSED',
          gatewaySubscriptionId: null,
        });
        repo.updateSubscription.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

        await service.resumeSubscription('sub-1');

        expect(factory._mockGateway.resumeSubscription).not.toHaveBeenCalled();
        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', { status: 'ACTIVE' });
      }));

    it('should throw BadGatewayException when provider resume fails', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionById.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          status: 'PAUSED',
          gatewaySubscriptionId: 'rzp_sub_1',
        });
        factory._mockGateway.resumeSubscription.mockRejectedValue(
          new PaymentGatewayError('Network error', 'RAZORPAY'),
        );

        await expect(service.resumeSubscription('sub-1')).rejects.toThrow(BadGatewayException);
        expect(repo.updateSubscription).not.toHaveBeenCalled();
      }));
  });

  // ---------------------------------------------------------------------------
  // processWebhookEvent
  // ---------------------------------------------------------------------------

  describe('processWebhookEvent', () => {
    it('should skip events without a subscription link', () =>
      requestContext.run(TEST_CTX, async () => {
        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'payment.captured',
          providerEventId: 'evt-1',
          payload: {},
        });

        // No providerSubscriptionId means no subscription lookup, no status change
        expect(repo.findSubscriptionByProviderId).not.toHaveBeenCalled();
        expect(repo.updateSubscription).not.toHaveBeenCalled();
        expect(repo.updateSubscriptionWithPlan).not.toHaveBeenCalled();
      }));

    it('should find subscription, handle event, and emit NATS event', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });
        repo.updateSubscriptionWithPlan.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
          status: 'ACTIVE',
          plan: { amount: 99900n, currency: 'INR', interval: 'MONTHLY' },
        });
        repo.createInvoice.mockResolvedValue({ id: 'inv-1' });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'payment.captured',
          providerEventId: 'evt-2',
          providerSubscriptionId: 'rzp_sub_1',
          providerPaymentId: 'pay_1',
          payload: { raw: true },
        });

        expect(repo.findSubscriptionByProviderId).toHaveBeenCalledWith('rzp_sub_1');
        expect(repo.updateSubscriptionWithPlan).toHaveBeenCalledWith('sub-1', {
          status: 'ACTIVE',
        });
        expect(natsClient.emit).toHaveBeenCalledWith(
          'BILLING.webhook.razorpay',
          expect.objectContaining({
            eventType: 'payment.captured',
            providerEventId: 'evt-2',
            provider: 'RAZORPAY',
          }),
        );
      }));

    it('should create invoice on charged/captured events using BillingPeriod', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });
        repo.updateSubscriptionWithPlan.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
          status: 'ACTIVE',
          plan: { amount: 99900n, currency: 'INR', interval: 'MONTHLY' },
        });
        repo.createInvoice.mockResolvedValue({ id: 'inv-1' });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'payment.captured',
          providerEventId: 'evt-3',
          providerSubscriptionId: 'rzp_sub_1',
          providerPaymentId: 'pay_1',
          payload: {},
        });

        expect(repo.createInvoice).toHaveBeenCalledWith(
          expect.objectContaining({
            subscriptionId: 'sub-1',
            tenantId: 'institute-1',
            resellerId: 'reseller-1',
            totalAmount: 99900n,
            currency: 'INR',
            status: 'PAID',
            invoiceNumber: expect.any(String),
            dueAt: expect.any(Date),
            periodStart: expect.any(Date),
            periodEnd: expect.any(Date),
          }),
        );

        // Verify billing period is roughly one month apart
        const invoiceCall = repo.createInvoice.mock.calls[0][0];
        const start = invoiceCall.periodStart as Date;
        const end = invoiceCall.periodEnd as Date;
        const diffMs = end.getTime() - start.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThanOrEqual(28);
        expect(diffDays).toBeLessThanOrEqual(31);
      }));

    it('should handle subscription activation events', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });
        repo.updateSubscriptionWithPlan.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
          status: 'ACTIVE',
          plan: { amount: 99900n, currency: 'INR', interval: 'MONTHLY' },
        });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'subscription.activated',
          providerEventId: 'evt-4',
          providerSubscriptionId: 'rzp_sub_1',
          payload: {},
        });

        expect(repo.updateSubscriptionWithPlan).toHaveBeenCalledWith('sub-1', {
          status: 'ACTIVE',
        });
        // activated events don't create invoices
        expect(repo.createInvoice).not.toHaveBeenCalled();
      }));

    it('should handle halted/past_due events', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'subscription.halted',
          providerEventId: 'evt-5',
          providerSubscriptionId: 'rzp_sub_1',
          payload: {},
        });

        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', { status: 'PAST_DUE' });
      }));

    it('should handle cancelled events', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'subscription.cancelled',
          providerEventId: 'evt-6',
          providerSubscriptionId: 'rzp_sub_1',
          payload: {},
        });

        expect(repo.updateSubscription).toHaveBeenCalledWith(
          'sub-1',
          expect.objectContaining({ status: 'CANCELLED', cancelledAt: expect.any(Date) }),
        );
      }));

    it('should handle completed events (no longer a recognized case — falls through to default)', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'subscription.completed',
          providerEventId: 'evt-7',
          providerSubscriptionId: 'rzp_sub_1',
          payload: {},
        });

        // subscription.completed is not handled — no status update
        expect(repo.updateSubscription).not.toHaveBeenCalled();
      }));

    it('should handle paused events', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'subscription.paused',
          providerEventId: 'evt-8',
          providerSubscriptionId: 'rzp_sub_1',
          payload: {},
        });

        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', { status: 'PAUSED' });
      }));

    it('should handle resumed events', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'subscription.resumed',
          providerEventId: 'evt-10',
          providerSubscriptionId: 'rzp_sub_1',
          payload: {},
        });

        expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', { status: 'ACTIVE' });
      }));

    it('should handle pending events (no longer a recognized case — falls through to default)', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'subscription.pending',
          providerEventId: 'evt-11',
          providerSubscriptionId: 'rzp_sub_1',
          payload: {},
        });

        // subscription.pending is not handled — no status update
        expect(repo.updateSubscription).not.toHaveBeenCalled();
      }));

    it('should handle updated events without status change', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });

        await service.processWebhookEvent('RAZORPAY', {
          eventType: 'subscription.updated',
          providerEventId: 'evt-12',
          providerSubscriptionId: 'rzp_sub_1',
          payload: {},
        });

        // updated events only log — no status change
        expect(repo.updateSubscription).not.toHaveBeenCalled();
        expect(repo.updateSubscriptionWithPlan).not.toHaveBeenCalled();
      }));

    it('should handle events without a subscription', () =>
      requestContext.run(TEST_CTX, async () => {
        await service.processWebhookEvent('CASHFREE', {
          eventType: 'payment.failed',
          providerEventId: 'evt-9',
          payload: {},
        });

        // No providerSubscriptionId — subscription lookup is skipped
        expect(repo.updateSubscription).not.toHaveBeenCalled();
        expect(natsClient.emit).toHaveBeenCalledWith(
          'BILLING.webhook.cashfree',
          expect.objectContaining({ provider: 'CASHFREE' }),
        );
      }));

    // ── Normalized Cashfree events (adapter normalizes before service) ──────
    // These test that the service correctly handles the normalized event types
    // that the CashfreeAdapter produces from raw Cashfree webhook events.

    it('should handle normalized Cashfree subscription.charged — activate + invoice', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });
        repo.updateSubscriptionWithPlan.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
          status: 'ACTIVE',
          plan: { amount: 99900n, currency: 'INR', interval: 'MONTHLY' },
        });
        repo.createInvoice.mockResolvedValue({ id: 'inv-1' });

        await service.processWebhookEvent('CASHFREE', {
          eventType: 'subscription.charged',
          providerEventId: 'cf-evt-1',
          providerSubscriptionId: 'cf_sub_1',
          providerPaymentId: 'cf_pay_1',
          payload: {},
        });

        expect(repo.updateSubscriptionWithPlan).toHaveBeenCalledWith('sub-1', {
          status: 'ACTIVE',
        });
        expect(repo.createInvoice).toHaveBeenCalledWith(
          expect.objectContaining({
            subscriptionId: 'sub-1',
            tenantId: 'institute-1',
            resellerId: 'reseller-1',
            totalAmount: 99900n,
            status: 'PAID',
            invoiceNumber: expect.any(String),
            dueAt: expect.any(Date),
            periodStart: expect.any(Date),
            periodEnd: expect.any(Date),
          }),
        );
      }));

    it('should handle normalized payment.failed — log only, no status change', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });

        await service.processWebhookEvent('CASHFREE', {
          eventType: 'payment.failed',
          providerEventId: 'cf-evt-2',
          providerSubscriptionId: 'cf_sub_1',
          providerPaymentId: 'cf_pay_2',
          payload: {},
        });

        expect(repo.updateSubscription).not.toHaveBeenCalled();
        expect(repo.updateSubscriptionWithPlan).not.toHaveBeenCalled();
        expect(repo.createInvoice).not.toHaveBeenCalled();
      }));

    it('should handle normalized payment.cancelled — log only, NOT cancel subscription', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
          resellerId: 'reseller-1',
        });

        await service.processWebhookEvent('CASHFREE', {
          eventType: 'payment.cancelled',
          providerEventId: 'cf-evt-3',
          providerSubscriptionId: 'cf_sub_1',
          payload: {},
        });

        // Must NOT cancel the subscription — this is a payment-level event
        expect(repo.updateSubscription).not.toHaveBeenCalled();
        expect(repo.updateSubscriptionWithPlan).not.toHaveBeenCalled();
      }));

    it('should handle normalized subscription.card_expiry_reminder — log only', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.claimPaymentEvent.mockResolvedValue(true);
        repo.markPaymentSucceeded.mockResolvedValue(undefined);
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
        });

        await service.processWebhookEvent('CASHFREE', {
          eventType: 'subscription.card_expiry_reminder',
          providerEventId: 'cf-evt-4',
          providerSubscriptionId: 'cf_sub_1',
          payload: {},
        });

        expect(repo.updateSubscription).not.toHaveBeenCalled();
        expect(repo.updateSubscriptionWithPlan).not.toHaveBeenCalled();
      }));

    describe('normalized Cashfree status change events', () => {
      function setupNormalizedEvent(normalizedEventType: string) {
        repo.claimPaymentEvent.mockResolvedValue(true);
        repo.markPaymentSucceeded.mockResolvedValue(undefined);
        repo.findSubscriptionByProviderId.mockResolvedValue({
          id: 'sub-1',
          tenantId: 'institute-1',
        });

        return service.processWebhookEvent('CASHFREE', {
          eventType: normalizedEventType,
          providerEventId: `cf-status-${normalizedEventType}`,
          providerSubscriptionId: 'cf_sub_1',
          payload: {},
        });
      }

      it('should handle subscription.activated (from CF ACTIVE)', () =>
        requestContext.run(TEST_CTX, async () => {
          repo.updateSubscriptionWithPlan.mockResolvedValue({
            id: 'sub-1',
            tenantId: 'institute-1',
            status: 'ACTIVE',
            plan: { amount: 99900n, currency: 'INR', interval: 'MONTHLY' },
          });

          await setupNormalizedEvent('subscription.activated');
          expect(repo.updateSubscriptionWithPlan).toHaveBeenCalledWith('sub-1', {
            status: 'ACTIVE',
          });
        }));

      it('should handle subscription.cancelled (from CF CUSTOMER_CANCELLED)', () =>
        requestContext.run(TEST_CTX, async () => {
          await setupNormalizedEvent('subscription.cancelled');
          expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', {
            status: 'CANCELLED',
            cancelledAt: expect.any(Date),
          });
        }));

      it('should handle subscription.paused (from CF CUSTOMER_PAUSED)', () =>
        requestContext.run(TEST_CTX, async () => {
          await setupNormalizedEvent('subscription.paused');
          expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', { status: 'PAUSED' });
        }));

      it('should handle subscription.halted (from CF ON_HOLD / CARD_EXPIRED)', () =>
        requestContext.run(TEST_CTX, async () => {
          await setupNormalizedEvent('subscription.halted');
          expect(repo.updateSubscription).toHaveBeenCalledWith('sub-1', { status: 'PAST_DUE' });
        }));

      it('should handle subscription.completed (from CF COMPLETED / EXPIRED) — no longer a recognized case', () =>
        requestContext.run(TEST_CTX, async () => {
          await setupNormalizedEvent('subscription.completed');
          // subscription.completed is not handled — no status update
          expect(repo.updateSubscription).not.toHaveBeenCalled();
        }));

      it('should handle subscription.pending (from CF BANK_APPROVAL_PENDING) — no longer a recognized case', () =>
        requestContext.run(TEST_CTX, async () => {
          await setupNormalizedEvent('subscription.pending');
          // subscription.pending is not handled — no status update
          expect(repo.updateSubscription).not.toHaveBeenCalled();
        }));
    });
  });

  // ---------------------------------------------------------------------------
  // findAllSubscriptions
  // ---------------------------------------------------------------------------

  describe('findAllSubscriptions', () => {
    it('should return paginated subscriptions', () =>
      requestContext.run(TEST_CTX, async () => {
        const subs = [
          {
            id: 'sub-1',
            status: 'ACTIVE',
            institute: { id: 'institute-1', name: 'Demo' },
            plan: { id: 'plan-1' },
          },
        ];
        repo.findAllSubscriptions.mockResolvedValue({ items: subs, totalCount: 1 });

        const result = await service.findAllSubscriptions({ first: 10 });

        expect(result.edges).toHaveLength(1);
        expect(result.edges[0].node.id).toBe('sub-1');
        expect(result.totalCount).toBe(1);
        expect(result.pageInfo.hasNextPage).toBe(false);
        expect(repo.findAllSubscriptions).toHaveBeenCalled();
      }));

    it('should filter by status', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findAllSubscriptions.mockResolvedValue({ items: [], totalCount: 0 });

        await service.findAllSubscriptions({ filter: { status: SubscriptionStatus.ACTIVE } });

        expect(repo.findAllSubscriptions).toHaveBeenCalledWith(
          expect.objectContaining({
            filter: { status: SubscriptionStatus.ACTIVE },
          }),
        );
      }));

    it('should cap take at 100', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findAllSubscriptions.mockResolvedValue({ items: [], totalCount: 0 });

        const result = await service.findAllSubscriptions({ first: 500 });

        expect(result.pageInfo.hasNextPage).toBe(false);
      }));

    it('should detect hasNextPage when more items exist', () =>
      requestContext.run(TEST_CTX, async () => {
        // Repo returns take+1 items to indicate there's a next page
        const items = Array.from({ length: 21 }, (_, i) => ({
          id: `sub-${i}`,
          status: 'ACTIVE',
        }));
        repo.findAllSubscriptions.mockResolvedValue({ items, totalCount: 50 });

        const result = await service.findAllSubscriptions({ first: 20 });

        expect(result.edges).toHaveLength(20);
        expect(result.pageInfo.hasNextPage).toBe(true);
      }));
  });

  // ---------------------------------------------------------------------------
  // findInvoices
  // ---------------------------------------------------------------------------

  describe('findInvoices', () => {
    it('should return paginated invoices without instituteId (admin)', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findInvoices.mockResolvedValue({ items: [{ id: 'inv-1' }], totalCount: 1 });

        const result = await service.findInvoices({ first: 10 });

        expect(result.edges).toHaveLength(1);
        expect(repo.findInvoices).toHaveBeenCalledWith(expect.objectContaining({ first: 11 }));
      }));

    it('should filter by instituteId when provided', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findInvoices.mockResolvedValue({ items: [], totalCount: 0 });

        await service.findInvoices({ instituteId: 'institute-1', first: 10 });

        expect(repo.findInvoices).toHaveBeenCalledWith(
          expect.objectContaining({ instituteId: 'institute-1' }),
        );
      }));

    it('should detect hasNextPage for invoices', () =>
      requestContext.run(TEST_CTX, async () => {
        const items = Array.from({ length: 11 }, (_, i) => ({ id: `inv-${i}` }));
        repo.findInvoices.mockResolvedValue({ items, totalCount: 30 });

        const result = await service.findInvoices({ first: 10 });

        expect(result.edges).toHaveLength(10);
        expect(result.pageInfo.hasNextPage).toBe(true);
      }));
  });

  // ---------------------------------------------------------------------------
  // findSubscription
  // ---------------------------------------------------------------------------

  describe('findSubscription', () => {
    it('should delegate to repo.findSubscriptionByInstitute', () =>
      requestContext.run(TEST_CTX, async () => {
        const mockAbility = createMockAbility();
        repo.findSubscriptionByInstitute.mockResolvedValue({ id: 'sub-1' });

        const result = await service.findSubscription('institute-1', mockAbility);

        expect(repo.findSubscriptionByInstitute).toHaveBeenCalledWith('institute-1', mockAbility);
        expect(result).toEqual({ id: 'sub-1' });
      }));
  });

  // ---------------------------------------------------------------------------
  // findPlan
  // ---------------------------------------------------------------------------

  describe('findPlan', () => {
    it('should delegate to repo.findPlanById', () =>
      requestContext.run(TEST_CTX, async () => {
        const mockAbility = createMockAbility();
        repo.findPlanById.mockResolvedValue({ id: 'plan-1', name: 'Pro' });

        const result = await service.findPlan('plan-1', mockAbility);

        expect(repo.findPlanById).toHaveBeenCalledWith('plan-1', mockAbility);
        expect(result).toEqual({ id: 'plan-1', name: 'Pro' });
      }));
  });
});
