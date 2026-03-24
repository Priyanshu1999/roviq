import { requestContext } from '@roviq/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionService } from '../reseller/subscription.service';

const TEST_CTX = { userId: 'test-user-1', tenantId: 'tenant-1', correlationId: 'test' };

function createMockSubRepo() {
  return {
    findActiveByTenant: vi.fn(),
    findById: vi.fn(),
    findByResellerId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function createMockPlanRepo() {
  return {
    findById: vi.fn(),
    findByCode: vi.fn(),
    findByResellerId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  };
}

function createMockNats() {
  return { emit: vi.fn().mockReturnValue({ subscribe: vi.fn() }) };
}

function createMockInvoiceService() {
  return { generateInvoice: vi.fn().mockResolvedValue({ id: 'inv-1' }) };
}

function createService(
  subRepo: ReturnType<typeof createMockSubRepo>,
  planRepo: ReturnType<typeof createMockPlanRepo>,
  nats: ReturnType<typeof createMockNats>,
): SubscriptionService {
  const svc = Object.create(SubscriptionService.prototype) as SubscriptionService;
  Object.assign(svc, {
    subscriptionRepo: subRepo,
    planRepo,
    invoiceService: createMockInvoiceService(),
    natsClient: nats,
    logger: { warn: vi.fn() },
  });
  return svc;
}

const activePlan = {
  id: 'plan-1',
  status: 'ACTIVE',
  resellerId: 'reseller-1',
  interval: 'MONTHLY',
  amount: 99900n,
  trialDays: 0,
  name: { en: 'Pro' },
};

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subRepo: ReturnType<typeof createMockSubRepo>;
  let planRepo: ReturnType<typeof createMockPlanRepo>;
  let nats: ReturnType<typeof createMockNats>;

  beforeEach(() => {
    subRepo = createMockSubRepo();
    planRepo = createMockPlanRepo();
    nats = createMockNats();
    service = createService(subRepo, planRepo, nats);
  });

  describe('assignPlan', () => {
    it('should reject if active subscription exists', () =>
      requestContext.run(TEST_CTX, async () => {
        subRepo.findActiveByTenant.mockResolvedValue({ id: 'existing-sub', status: 'ACTIVE' });
        await expect(
          service.assignPlan('reseller-1', { tenantId: 'tenant-1', planId: 'plan-1' }),
        ).rejects.toThrow(/already has/);
      }));

    it('should create active subscription for plan without trial', () =>
      requestContext.run(TEST_CTX, async () => {
        subRepo.findActiveByTenant.mockResolvedValue(null);
        planRepo.findById.mockResolvedValue(activePlan);
        subRepo.create.mockResolvedValue({ id: 'new-sub', status: 'ACTIVE', plan: activePlan });

        const result = await service.assignPlan('reseller-1', {
          tenantId: 'tenant-1',
          planId: 'plan-1',
        });
        expect(result.status).toBe('ACTIVE');
        expect(subRepo.create).toHaveBeenCalledWith(
          'reseller-1',
          expect.objectContaining({ status: 'ACTIVE', tenantId: 'tenant-1' }),
        );
      }));

    it('should create trialing subscription for plan with trial days', () =>
      requestContext.run(TEST_CTX, async () => {
        subRepo.findActiveByTenant.mockResolvedValue(null);
        planRepo.findById.mockResolvedValue({ ...activePlan, trialDays: 14 });
        subRepo.create.mockResolvedValue({ id: 'new-sub', status: 'TRIALING', plan: activePlan });

        const result = await service.assignPlan('reseller-1', {
          tenantId: 'tenant-1',
          planId: 'plan-1',
        });
        expect(result.status).toBe('TRIALING');
      }));
  });

  describe('status transitions', () => {
    const makeSub = (status: string) => ({
      id: 'sub-1',
      status,
      tenantId: 'tenant-1',
      resellerId: 'reseller-1',
      planId: 'plan-1',
      currentPeriodStart: new Date('2026-01-01'),
      currentPeriodEnd: new Date('2026-02-01'),
      plan: activePlan,
      cancelledAt: null,
      pausedAt: null,
      metadata: null,
    });

    describe('pause', () => {
      it('should allow ACTIVE → PAUSED', async () => {
        subRepo.findById.mockResolvedValue(makeSub('ACTIVE'));
        subRepo.update.mockResolvedValue({ ...makeSub('PAUSED') });
        await service.pauseSubscription('reseller-1', 'sub-1');
        expect(subRepo.update).toHaveBeenCalledWith(
          'reseller-1',
          'sub-1',
          expect.objectContaining({ status: 'PAUSED' }),
        );
      });

      it('should reject CANCELLED → PAUSED', async () => {
        subRepo.findById.mockResolvedValue(makeSub('CANCELLED'));
        await expect(service.pauseSubscription('reseller-1', 'sub-1')).rejects.toThrow(
          /Cannot transition/,
        );
      });

      it('should reject EXPIRED → PAUSED', async () => {
        subRepo.findById.mockResolvedValue(makeSub('EXPIRED'));
        await expect(service.pauseSubscription('reseller-1', 'sub-1')).rejects.toThrow(
          /Cannot transition/,
        );
      });
    });

    describe('resume', () => {
      it('should allow PAUSED → ACTIVE', async () => {
        subRepo.findById.mockResolvedValue(makeSub('PAUSED'));
        subRepo.update.mockResolvedValue({ ...makeSub('ACTIVE') });
        await service.resumeSubscription('reseller-1', 'sub-1');
        expect(subRepo.update).toHaveBeenCalledWith(
          'reseller-1',
          'sub-1',
          expect.objectContaining({ status: 'ACTIVE' }),
        );
      });

      it('should reject ACTIVE → ACTIVE (not paused)', async () => {
        subRepo.findById.mockResolvedValue(makeSub('ACTIVE'));
        await expect(service.resumeSubscription('reseller-1', 'sub-1')).rejects.toThrow(
          /Cannot transition/,
        );
      });
    });

    describe('cancel', () => {
      it('should allow ACTIVE → CANCELLED', async () => {
        subRepo.findById.mockResolvedValue(makeSub('ACTIVE'));
        subRepo.update.mockResolvedValue({ ...makeSub('CANCELLED') });
        await service.cancelSubscription('reseller-1', 'sub-1', 'Test reason');
        expect(subRepo.update).toHaveBeenCalledWith(
          'reseller-1',
          'sub-1',
          expect.objectContaining({ status: 'CANCELLED', cancelReason: 'Test reason' }),
        );
      });

      it('should allow PAUSED → CANCELLED', async () => {
        subRepo.findById.mockResolvedValue(makeSub('PAUSED'));
        subRepo.update.mockResolvedValue({ ...makeSub('CANCELLED') });
        await service.cancelSubscription('reseller-1', 'sub-1');
        expect(subRepo.update).toHaveBeenCalled();
      });

      it('should allow PAST_DUE → CANCELLED', async () => {
        subRepo.findById.mockResolvedValue(makeSub('PAST_DUE'));
        subRepo.update.mockResolvedValue({ ...makeSub('CANCELLED') });
        await service.cancelSubscription('reseller-1', 'sub-1');
        expect(subRepo.update).toHaveBeenCalled();
      });

      it('should reject CANCELLED → CANCELLED (already terminal)', async () => {
        subRepo.findById.mockResolvedValue(makeSub('CANCELLED'));
        await expect(service.cancelSubscription('reseller-1', 'sub-1')).rejects.toThrow(
          /Cannot transition/,
        );
      });

      it('should reject EXPIRED → CANCELLED (already terminal)', async () => {
        subRepo.findById.mockResolvedValue(makeSub('EXPIRED'));
        await expect(service.cancelSubscription('reseller-1', 'sub-1')).rejects.toThrow(
          /Cannot transition/,
        );
      });
    });
  });

  describe('changePlan (proration)', () => {
    it('should calculate proration correctly — 15 days remaining in 30-day month', async () => {
      const now = new Date('2026-01-16T00:00:00Z');
      vi.setSystemTime(now);

      const sub = {
        id: 'sub-1',
        status: 'ACTIVE',
        tenantId: 'tenant-1',
        resellerId: 'reseller-1',
        planId: 'old-plan',
        currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-01-31T00:00:00Z'),
        plan: { ...activePlan, id: 'old-plan', amount: 100000n },
        cancelledAt: null,
        pausedAt: null,
        metadata: null,
      };

      subRepo.findById.mockResolvedValue(sub);
      planRepo.findById.mockResolvedValue({ ...activePlan, id: 'new-plan', amount: 200000n });
      subRepo.update.mockResolvedValue({ ...sub, planId: 'new-plan' });

      await service.changePlan('reseller-1', 'sub-1', 'new-plan');

      // 15 days remaining out of 30 days = 50% remaining
      // Credit = 50% * 100000 = 50000
      // Charge = 50% * 200000 = 100000
      // Delta = 100000 - 50000 = 50000
      expect(subRepo.update).toHaveBeenCalledWith(
        'reseller-1',
        'sub-1',
        expect.objectContaining({
          planId: 'new-plan',
          metadata: expect.objectContaining({
            lastPlanChange: expect.objectContaining({
              credit: 50000,
              charge: 100000,
              prorationDelta: 50000,
            }),
          }),
        }),
      );

      vi.useRealTimers();
    });
  });
});
