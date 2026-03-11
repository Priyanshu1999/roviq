import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditService } from '../audit.service';

function createMockClient() {
  return {
    query: vi.fn(),
    release: vi.fn(),
  };
}

function createMockPool() {
  const client = createMockClient();
  return {
    connect: vi.fn().mockResolvedValue(client),
    _client: client,
  };
}

/** Set up the client mock to handle BEGIN, set_config, data query, count query, COMMIT */
function setupClientMock(
  client: ReturnType<typeof createMockClient>,
  dataRows: Record<string, unknown>[],
  countValue: string,
) {
  client.query.mockImplementation((query: string) => {
    if (query === 'BEGIN' || query === 'COMMIT' || query === 'ROLLBACK') {
      return Promise.resolve();
    }
    if (query.includes('set_config')) {
      return Promise.resolve();
    }
    if (query.includes('SELECT al.*')) {
      return Promise.resolve({ rows: dataRows });
    }
    if (query.includes('COUNT(*)')) {
      return Promise.resolve({ rows: [{ count: countValue }] });
    }
    return Promise.resolve({ rows: [] });
  });
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
    actor_name: 'testactor',
    user_name: 'testuser',
    tenant_name: 'Test Institute',
    ...overrides,
  };
}

describe('AuditService', () => {
  let service: AuditService;
  let mockPool: ReturnType<typeof createMockPool>;
  let client: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createMockPool();
    client = mockPool._client;
    service = new AuditService(mockPool as never);
  });

  describe('findAuditLogs', () => {
    it('should return paginated results with correct structure', async () => {
      const row = createAuditRow();
      setupClientMock(client, [row], '1');

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

    it('should set RLS context via set_config in a transaction', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({ tenantId: 'tenant-abc', first: 20 });

      const calls = client.query.mock.calls.map((c) => c[0]);
      expect(calls[0]).toBe('BEGIN');
      expect(calls[1]).toContain('set_config');
      // set_config receives tenantId as parameter
      expect(client.query.mock.calls[1][1]).toEqual(['tenant-abc']);
    });

    it('should always filter by tenantId', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({ tenantId: 'tenant-abc', first: 20 });

      // Find the data query call (contains SELECT al.*)
      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall).toBeDefined();
      expect(dataCall![0]).toContain('al.tenant_id = $1');
      expect(dataCall![1][0]).toBe('tenant-abc');
    });

    it('should detect hasNextPage when more rows than first', async () => {
      const rows = Array.from({ length: 3 }, (_, i) =>
        createAuditRow({ id: `log-${i}`, created_at: new Date(`2026-01-0${i + 1}`) }),
      );
      setupClientMock(client, rows, '5');

      const result = await service.findAuditLogs({ tenantId: 'tenant-1', first: 2 });

      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.edges).toHaveLength(2);
      expect(result.totalCount).toBe(5);
    });

    it('should apply entityType filter', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { entityType: 'User' },
      });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall![0]).toContain('al.entity_type = $2');
      expect(dataCall![1][1]).toBe('User');
    });

    it('should apply userId filter', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { userId: 'user-xyz' },
      });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall![0]).toContain('al.user_id = $2');
      expect(dataCall![1][1]).toBe('user-xyz');
    });

    it('should apply actionTypes filter', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { actionTypes: ['CREATE', 'DELETE'] },
      });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall![0]).toContain('al.action_type = ANY($2)');
      expect(dataCall![1][1]).toEqual(['CREATE', 'DELETE']);
    });

    it('should apply correlationId filter', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { correlationId: 'corr-abc' },
      });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall![0]).toContain('al.correlation_id = $2');
      expect(dataCall![1][1]).toBe('corr-abc');
    });

    it('should apply dateRange filter', async () => {
      const from = new Date('2026-01-01');
      const to = new Date('2026-01-31');
      setupClientMock(client, [], '0');

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: { dateRange: { from, to } },
      });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall![0]).toContain('al.created_at >= $2');
      expect(dataCall![0]).toContain('al.created_at <= $3');
      expect(dataCall![1][1]).toBe(from);
      expect(dataCall![1][2]).toBe(to);
    });

    it('should apply multiple filters simultaneously', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        filter: {
          entityType: 'User',
          userId: 'user-1',
          actionTypes: ['CREATE'],
        },
      });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall![0]).toContain('al.tenant_id = $1');
      expect(dataCall![0]).toContain('al.entity_type = $2');
      expect(dataCall![0]).toContain('al.user_id = $3');
      expect(dataCall![0]).toContain('al.action_type = ANY($4)');
      expect(dataCall![1]).toEqual(['tenant-1', 'User', 'user-1', ['CREATE'], 21]);
    });

    it('should handle cursor-based pagination (after param)', async () => {
      const cursor = Buffer.from('2026-01-01T00:00:00.000Z:log-1').toString('base64url');
      setupClientMock(client, [], '0');

      const result = await service.findAuditLogs({
        tenantId: 'tenant-1',
        first: 20,
        after: cursor,
      });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall![0]).toContain('(al.created_at, al.id) < ($2, $3)');
      expect(dataCall![1][1]).toBe('2026-01-01T00:00:00.000Z');
      expect(dataCall![1][2]).toBe('log-1');
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should generate valid base64url cursors', async () => {
      const row = createAuditRow({
        created_at: new Date('2026-03-15T10:30:00Z'),
        id: 'abc-123',
      });
      setupClientMock(client, [row], '1');

      const result = await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });

      const cursor = result.edges[0].cursor;
      const decoded = Buffer.from(cursor, 'base64url').toString();
      expect(decoded).toBe('2026-03-15T10:30:00.000Z:abc-123');
    });

    it('should return empty edges when no results', async () => {
      setupClientMock(client, [], '0');

      const result = await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });

      expect(result.edges).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.endCursor).toBeNull();
      expect(result.pageInfo.startCursor).toBeNull();
    });

    it('should use parameterized queries for all values', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({
        tenantId: "'; DROP TABLE audit_logs;--",
        first: 20,
        filter: { entityType: "Robert'; DROP TABLE--" },
      });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall![0]).not.toContain('DROP TABLE');
      expect(dataCall![0]).toContain('$1');
      expect(dataCall![0]).toContain('$2');
    });

    it('should order by created_at DESC, id DESC', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      expect(dataCall![0]).toContain('ORDER BY al.created_at DESC, al.id DESC');
    });

    it('should map snake_case DB columns to camelCase', async () => {
      const row = createAuditRow({
        impersonator_id: 'admin-1',
        ip_address: '10.0.0.1',
        user_agent: 'Mozilla/5.0',
        correlation_id: 'corr-xyz',
      });
      setupClientMock(client, [row], '1');

      const result = await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });
      const node = result.edges[0].node;

      expect(node.impersonatorId).toBe('admin-1');
      expect(node.ipAddress).toBe('10.0.0.1');
      expect(node.userAgent).toBe('Mozilla/5.0');
      expect(node.correlationId).toBe('corr-xyz');
    });

    it('should request first+1 rows for hasNextPage detection', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({ tenantId: 'tenant-1', first: 10 });

      const dataCall = client.query.mock.calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('SELECT al.*'),
      );
      const dataValues = dataCall![1];
      expect(dataValues[dataValues.length - 1]).toBe(11);
    });

    it('should run data and count queries via client within a transaction', async () => {
      setupClientMock(client, [], '0');

      await service.findAuditLogs({ tenantId: 'tenant-1', first: 20 });

      const calls = client.query.mock.calls.map((c) => c[0] as string);
      expect(calls[0]).toBe('BEGIN');
      expect(calls[1]).toContain('set_config');
      // Data and count queries run within the same transaction, then COMMIT
      expect(calls).toContainEqual(expect.stringContaining('SELECT al.*'));
      expect(calls).toContainEqual(expect.stringContaining('COUNT(*)'));
      expect(calls[calls.length - 1]).toBe('COMMIT');
      expect(client.release).toHaveBeenCalled();
    });

    it('should rollback and release client on error', async () => {
      client.query.mockImplementation((query: string) => {
        if (query === 'BEGIN') return Promise.resolve();
        if (query.includes('set_config')) return Promise.resolve();
        if (query === 'ROLLBACK') return Promise.resolve();
        return Promise.reject(new Error('DB error'));
      });

      await expect(service.findAuditLogs({ tenantId: 'tenant-1', first: 20 })).rejects.toThrow(
        'DB error',
      );

      const calls = client.query.mock.calls.map((c) => c[0] as string);
      expect(calls).toContain('ROLLBACK');
      expect(client.release).toHaveBeenCalled();
    });
  });
});
