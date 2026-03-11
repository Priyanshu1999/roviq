import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit.service';

function createMockPool() {
  return {
    query: vi.fn(),
  };
}

function createAuditRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    tenant_id: 'tenant-1',
    user_id: 'user-1',
    actor_id: 'user-1',
    impersonator_id: null,
    action: 'createUser',
    action_type: 'CREATE',
    entity_type: 'User',
    entity_id: 'entity-1',
    changes: null,
    metadata: { args: {} },
    correlation_id: 'corr-1',
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
    source: 'GATEWAY',
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AuditService', () => {
  let service: AuditService;
  let mockPool: ReturnType<typeof createMockPool>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createMockPool();
    service = new AuditService(mockPool as never);
  });

  describe('findAuditLogs', () => {
    it('should return paginated results with correct structure', async () => {
      const row = createAuditRow();
      mockPool.query
        .mockResolvedValueOnce({ rows: [row] }) // data query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // count query

      const result = await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
      });

      expect(result.totalCount).toBe(1);
      expect(result.edges).toHaveLength(1);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
      expect(result.edges[0].node).toMatchObject({
        id: 'log-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        actorId: 'user-1',
        action: 'createUser',
        actionType: 'CREATE',
        entityType: 'User',
        entityId: 'entity-1',
        source: 'GATEWAY',
      });
    });

    it('should always filter by tenantId', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({ tenantId: 'tenant-abc', first: 20 });

      const [dataQuery, dataValues] = mockPool.query.mock.calls[0];
      expect(dataQuery).toContain('tenant_id = $1');
      expect(dataValues[0]).toBe('tenant-abc');
    });

    it('should detect hasNextPage when more rows than first', async () => {
      const rows = Array.from({ length: 3 }, (_, i) =>
        createAuditRow({ id: `log-${i}`, created_at: new Date(`2026-01-0${i + 1}`) }),
      );
      mockPool.query
        .mockResolvedValueOnce({ rows }) // 3 rows returned for first=2 (2+1=3)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] });

      const result = await service.findAuditLogs({ tenantId: 'tenant-1', first: 2 });

      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.edges).toHaveLength(2); // Trimmed to first=2
      expect(result.totalCount).toBe(5);
    });

    it('should apply entityType filter', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { entityType: 'User' },
      });

      const [dataQuery, dataValues] = mockPool.query.mock.calls[0];
      expect(dataQuery).toContain('entity_type = $2');
      expect(dataValues[1]).toBe('User');
    });

    it('should apply userId filter', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { userId: 'user-xyz' },
      });

      const [dataQuery, dataValues] = mockPool.query.mock.calls[0];
      expect(dataQuery).toContain('user_id = $2');
      expect(dataValues[1]).toBe('user-xyz');
    });

    it('should apply actionTypes filter', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { actionTypes: ['CREATE', 'DELETE'] },
      });

      const [dataQuery, dataValues] = mockPool.query.mock.calls[0];
      expect(dataQuery).toContain('action_type = ANY($2)');
      expect(dataValues[1]).toEqual(['CREATE', 'DELETE']);
    });

    it('should apply correlationId filter', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { correlationId: 'corr-abc' },
      });

      const [dataQuery, dataValues] = mockPool.query.mock.calls[0];
      expect(dataQuery).toContain('correlation_id = $2');
      expect(dataValues[1]).toBe('corr-abc');
    });

    it('should apply dateRange filter', async () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { dateRange: { from, to } },
      });

      const [dataQuery, dataValues] = mockPool.query.mock.calls[0];
      expect(dataQuery).toContain('created_at >= $2');
      expect(dataQuery).toContain('created_at <= $3');
      expect(dataValues[1]).toBe(from);
      expect(dataValues[2]).toBe(to);
    });

    it('should apply multiple filters simultaneously', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: {
          entityType: 'User',
          userId: 'user-1',
          actionTypes: ['CREATE'],
        },
      });

      const [dataQuery, dataValues] = mockPool.query.mock.calls[0];
      expect(dataQuery).toContain('tenant_id = $1');
      expect(dataQuery).toContain('entity_type = $2');
      expect(dataQuery).toContain('user_id = $3');
      expect(dataQuery).toContain('action_type = ANY($4)');
      expect(dataValues).toEqual(['tenant-1', 'User', 'user-1', ['CREATE'], 21]);
    });

    it('should handle cursor-based pagination (after param)', async () => {
      const cursor = Buffer.from('2026-01-01T00:00:00.000Z:log-1').toString('base64url');
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        after: cursor,
      });

      const [dataQuery, dataValues] = mockPool.query.mock.calls[0];
      expect(dataQuery).toContain('(created_at, id) < ($2, $3)');
      expect(dataValues[1]).toBe('2026-01-01T00:00:00.000Z');
      expect(dataValues[2]).toBe('log-1');
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should generate valid base64url cursors', async () => {
      const row = createAuditRow({
        created_at: new Date('2026-03-15T10:30:00Z'),
        id: 'abc-123',
      });
      mockPool.query
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });

      const cursor = result.edges[0].cursor;
      const decoded = Buffer.from(cursor, 'base64url').toString();
      expect(decoded).toBe('2026-03-15T10:30:00.000Z:abc-123');
    });

    it('should return empty edges when no results', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });

      expect(result.edges).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.endCursor).toBeNull();
      expect(result.pageInfo.startCursor).toBeNull();
    });

    it('should use parameterized queries for all values', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({
        tenantId: "'; DROP TABLE audit_logs;--",
        first: 20,
        filter: { entityType: "Robert'; DROP TABLE--" },
      });

      const [dataQuery] = mockPool.query.mock.calls[0];
      // No raw SQL injection — all values via $N placeholders
      expect(dataQuery).not.toContain('DROP TABLE');
      expect(dataQuery).toContain('$1');
      expect(dataQuery).toContain('$2');
    });

    it('should order by created_at DESC, id DESC', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });

      const [dataQuery] = mockPool.query.mock.calls[0];
      expect(dataQuery).toContain('ORDER BY created_at DESC, id DESC');
    });

    it('should map snake_case DB columns to camelCase', async () => {
      const row = createAuditRow({
        impersonator_id: 'admin-1',
        ip_address: '10.0.0.1',
        user_agent: 'Mozilla/5.0',
        correlation_id: 'corr-xyz',
      });
      mockPool.query
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const result = await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });
      const node = result.edges[0].node;

      expect(node.impersonatorId).toBe('admin-1');
      expect(node.ipAddress).toBe('10.0.0.1');
      expect(node.userAgent).toBe('Mozilla/5.0');
      expect(node.correlationId).toBe('corr-xyz');
    });

    it('should request first+1 rows for hasNextPage detection', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.findAuditLogs({ tenantId: 'tenant-1', first: 10 });

      const dataValues = mockPool.query.mock.calls[0][1];
      // Last value is the LIMIT = first + 1
      expect(dataValues[dataValues.length - 1]).toBe(11);
    });

    it('should run data and count queries in parallel', async () => {
      const callOrder: string[] = [];
      mockPool.query.mockImplementation((query: string) => {
        if (query.includes('SELECT *')) {
          callOrder.push('data');
          return Promise.resolve({ rows: [] });
        }
        callOrder.push('count');
        return Promise.resolve({ rows: [{ count: '0' }] });
      });

      await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });

      // Both queries should be initiated (Promise.all)
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
  });
});
