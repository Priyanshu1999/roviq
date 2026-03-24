import { requestContext } from '@roviq/common-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanService } from '../reseller/plan.service';

const TEST_CTX = { userId: 'test-user-1', tenantId: 'tenant-1', correlationId: 'test' };

function createMockRepo() {
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

/** Create PlanService with mock DI — avoids type assertions */
function createService(
  repo: ReturnType<typeof createMockRepo>,
  nats: ReturnType<typeof createMockNats>,
): PlanService {
  const svc = Object.create(PlanService.prototype) as PlanService;
  Object.assign(svc, { repo, natsClient: nats, logger: { warn: vi.fn() } });
  return svc;
}

describe('PlanService', () => {
  let service: PlanService;
  let repo: ReturnType<typeof createMockRepo>;
  let nats: ReturnType<typeof createMockNats>;

  beforeEach(() => {
    repo = createMockRepo();
    nats = createMockNats();
    service = createService(repo, nats);
  });

  describe('createPlan', () => {
    it('should reject duplicate code per reseller', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findByCode.mockResolvedValue({ id: 'existing-plan', code: 'PRO' });

        await expect(
          service.createPlan('reseller-1', {
            name: { en: 'Pro' },
            code: 'PRO',
            interval: 'MONTHLY',
            amount: 99900n,
            entitlements: {
              maxStudents: null,
              maxStaff: null,
              maxStorageMb: null,
              auditLogRetentionDays: 90,
              features: [],
            },
          }),
        ).rejects.toThrow(/already exists/);
      }));

    it('should create plan when code is unique', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.findByCode.mockResolvedValue(null);
        repo.create.mockResolvedValue({ id: 'new-plan', name: { en: 'Pro' }, code: 'PRO' });

        const result = await service.createPlan('reseller-1', {
          name: { en: 'Pro' },
          code: 'PRO',
          interval: 'MONTHLY',
          amount: 99900n,
          entitlements: {
            maxStudents: null,
            maxStaff: null,
            maxStorageMb: null,
            auditLogRetentionDays: 90,
            features: [],
          },
        });

        expect(result.id).toBe('new-plan');
        expect(repo.create).toHaveBeenCalledWith(
          'reseller-1',
          expect.objectContaining({ code: 'PRO', resellerId: 'reseller-1' }),
        );
      }));
  });

  describe('updatePlan', () => {
    it('should pass version for optimistic concurrency', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.update.mockResolvedValue({ id: 'plan-1', version: 3 });

        await service.updatePlan('reseller-1', 'plan-1', { version: 2, name: { en: 'Updated' } });

        expect(repo.update).toHaveBeenCalledWith(
          'reseller-1',
          'plan-1',
          expect.objectContaining({ name: { en: 'Updated' } }),
          2,
        );
      }));
  });

  describe('deletePlan', () => {
    it('should delegate to repo softDelete', () =>
      requestContext.run(TEST_CTX, async () => {
        repo.softDelete.mockResolvedValue({ id: 'plan-1' });

        await service.deletePlan('reseller-1', 'plan-1');

        expect(repo.softDelete).toHaveBeenCalledWith('reseller-1', 'plan-1');
      }));
  });

  describe('getPlan', () => {
    it('should throw when plan not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getPlan('reseller-1', 'nonexistent')).rejects.toThrow(/not found/);
    });

    it('should return plan when found', async () => {
      repo.findById.mockResolvedValue({ id: 'plan-1', name: { en: 'Pro' } });
      const result = await service.getPlan('reseller-1', 'plan-1');
      expect(result.id).toBe('plan-1');
    });
  });
});
