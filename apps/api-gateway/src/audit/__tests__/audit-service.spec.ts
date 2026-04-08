import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit.service';
import { AuditQueryRepository } from '../repositories/audit-query.repository';

function createMockAuditQueryRepo() {
  return createMock<AuditQueryRepository>({
    findAuditLogs: vi.fn(),
  });
}

describe('AuditService', () => {
  let service: AuditService;
  let mockQueryRepo: ReturnType<typeof createMockAuditQueryRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryRepo = createMockAuditQueryRepo();
    service = new AuditService(mockQueryRepo);
  });

  describe('findAuditLogs', () => {
    it('should delegate to auditQueryRepo', async () => {
      const mockResult = {
        edges: [],
        totalCount: 0,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
          startCursor: null,
        },
      };
      mockQueryRepo.findAuditLogs.mockResolvedValue(mockResult);

      const params = { tenantId: 'tenant-1', first: 20 };
      const result = await service.findAuditLogs(params);

      expect(mockQueryRepo.findAuditLogs).toHaveBeenCalledWith(params);
      expect(result).toBe(mockResult);
    });

    it('should pass filters through to repository', async () => {
      mockQueryRepo.findAuditLogs.mockResolvedValue({
        edges: [],
        totalCount: 0,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: null,
          startCursor: null,
        },
      });

      const params = {
        tenantId: 'tenant-1',
        first: 20,
        filter: { entityType: 'User', userId: 'user-1' },
      };
      await service.findAuditLogs(params);

      expect(mockQueryRepo.findAuditLogs).toHaveBeenCalledWith(params);
    });

    it('should return the repo result as-is', async () => {
      const mockResult = {
        edges: [
          {
            cursor: 'abc',
            node: {
              id: 'log-1',
              scope: 'institute',
              tenantId: 'tenant-1',
              resellerId: null,
              userId: 'user-1',
              actorId: 'user-1',
              impersonatorId: null,
              impersonationSessionId: null,
              action: 'createUser',
              actionType: 'CREATE',
              entityType: 'User',
              entityId: 'entity-1',
              changes: null,
              metadata: null,
              correlationId: 'corr-1',
              ipAddress: null,
              userAgent: null,
              source: 'GATEWAY',
              createdAt: new Date('2026-01-01'),
              actorName: null,
              userName: null,
              tenantName: null,
            },
          },
        ],
        totalCount: 1,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: 'abc',
          startCursor: 'abc',
        },
      };
      mockQueryRepo.findAuditLogs.mockResolvedValue(mockResult);

      const result = await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });

      expect(result).toBe(mockResult);
    });
  });
});
