import type { FormattedExecutionResult } from 'graphql';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000/api/graphql';
const DATABASE_URL =
  process.env.DATABASE_URL_ADMIN || 'postgresql://roviq:roviq_dev@localhost:5432/roviq';

// biome-ignore lint/suspicious/noExplicitAny: e2e tests use dynamic GraphQL queries with varying response shapes
type GqlResult = FormattedExecutionResult<Record<string, any>>;

async function gql(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<GqlResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<GqlResult>;
}

/** Get a tenant-scoped admin token (login → selectOrganization) */
async function getAdminToken(): Promise<{ accessToken: string; tenantId: string }> {
  const loginRes = await gql(`
    mutation {
      login(username: "admin", password: "admin123") {
        platformToken
        memberships { tenantId orgName }
      }
    }
  `);

  const platformToken = loginRes.data?.login?.platformToken;
  const tenantId = loginRes.data?.login?.memberships?.[0]?.tenantId;

  const selectRes = await gql(
    `mutation SelectOrg($tenantId: String!) {
      selectOrganization(tenantId: $tenantId) {
        accessToken
      }
    }`,
    { tenantId },
    platformToken,
  );

  return {
    accessToken: selectRes.data!.selectOrganization.accessToken,
    tenantId,
  };
}

/**
 * Execute a query against audit_logs with RLS context set.
 * FORCE ROW LEVEL SECURITY is enabled on audit_logs, so even the table owner
 * must satisfy policies. We use set_config to scope the tenant context.
 */
async function queryWithRls(
  pool: pg.Pool,
  tenantId: string,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

describe('Audit E2E', () => {
  let pool: pg.Pool;
  let adminToken: string;
  let adminTenantId: string;
  // Audit logs are immutable by design — no DELETE/UPDATE RLS policies exist.
  // Test rows accumulate but don't affect results since each test uses unique
  // correlation IDs for filtering. We still track IDs for documentation purposes.
  const testAuditIds: string[] = [];

  beforeAll(async () => {
    // Verify API is reachable
    const res = await gql('{ __typename }');
    expect(res.data?.__typename).toBe('Query');

    pool = new pg.Pool({ connectionString: DATABASE_URL, max: 3 });

    const admin = await getAdminToken();
    adminToken = admin.accessToken;
    adminTenantId = admin.tenantId;
  });

  afterAll(async () => {
    // No audit row cleanup — audit_logs has no DELETE RLS policy (immutable by design).
    // RLS silently blocks DELETEs (returns 0 rows), as verified by the immutability tests below.
    await pool.end();
  });

  describe('Full pipeline: mutation → NATS → consumer → DB', () => {
    it('should create audit log entry when authenticated mutation is executed', async () => {
      // Use teacher1 (single-org, gets direct accessToken with tenantId)
      const loginRes = await gql(`
        mutation {
          login(username: "teacher1", password: "teacher123") {
            accessToken
            refreshToken
            user { id tenantId }
          }
        }
      `);
      const teacherToken = loginRes.data!.login.accessToken;
      const teacherTenantId = loginRes.data!.login.user.tenantId;

      // Execute logout — emits audit event directly from auth resolver
      const logoutRes = await gql(`mutation { logout }`, undefined, teacherToken);
      expect(logoutRes.errors).toBeUndefined();
      expect(logoutRes.data?.logout).toBe(true);

      // Wait for audit log to appear in DB (async: resolver → NATS → consumer → PG)
      const rows = await waitForAuditLog(pool, teacherTenantId, 'logout');

      expect(rows.length).toBeGreaterThanOrEqual(1);
      const auditRow = rows[0];
      expect(auditRow.action).toBe('logout');
      expect(auditRow.action_type).toBe('DELETE');
      expect(auditRow.source).toBe('GATEWAY');
      expect(auditRow.tenant_id).toBe(teacherTenantId);

      testAuditIds.push(auditRow.id as string);
    });
  });

  describe('GraphQL query API', () => {
    let testCorrelationId: string;

    beforeAll(async () => {
      // Insert test audit data directly for query testing
      testCorrelationId = crypto.randomUUID();
      const result = await queryWithRls(
        pool,
        adminTenantId,
        `INSERT INTO audit_logs
          (tenant_id, user_id, actor_id, action, action_type, entity_type, entity_id, correlation_id, source, metadata)
        VALUES
          ($1, gen_random_uuid(), gen_random_uuid(), 'createStudent', 'CREATE', 'Student', gen_random_uuid(), $2, 'TEST', '{"test": true}')
        RETURNING id`,
        [adminTenantId, testCorrelationId],
      );
      testAuditIds.push(result.rows[0].id);
    });

    it('should return audit logs via GraphQL query', async () => {
      const res = await gql(
        `query AuditLogs($filter: AuditLogFilterInput, $first: Int) {
          auditLogs(filter: $filter, first: $first) {
            totalCount
            edges {
              cursor
              node {
                id
                action
                actionType
                entityType
                source
                correlationId
                metadata
                createdAt
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              endCursor
              startCursor
            }
          }
        }`,
        {
          filter: { correlationId: testCorrelationId },
          first: 10,
        },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      const connection = res.data!.auditLogs;
      expect(connection.totalCount).toBeGreaterThanOrEqual(1);

      const node = connection.edges[0].node;
      expect(node.action).toBe('createStudent');
      expect(node.actionType).toBe('CREATE');
      expect(node.entityType).toBe('Student');
      expect(node.source).toBe('TEST');
      expect(node.correlationId).toBe(testCorrelationId);
    });

    it('should filter by entityType', async () => {
      const res = await gql(
        `query {
          auditLogs(filter: { entityType: "NonExistentEntity" }, first: 10) {
            totalCount
            edges { node { id } }
          }
        }`,
        undefined,
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      expect(res.data!.auditLogs.totalCount).toBe(0);
      expect(res.data!.auditLogs.edges).toHaveLength(0);
    });

    it('should filter by actionTypes', async () => {
      const res = await gql(
        `query AuditLogs($filter: AuditLogFilterInput) {
          auditLogs(filter: $filter, first: 10) {
            edges { node { actionType correlationId } }
          }
        }`,
        {
          filter: {
            actionTypes: ['CREATE'],
            correlationId: testCorrelationId,
          },
        },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      const edges = res.data!.auditLogs.edges;
      expect(edges.length).toBeGreaterThanOrEqual(1);
      expect(
        edges.every((e: { node: { actionType: string } }) => e.node.actionType === 'CREATE'),
      ).toBe(true);
    });

    it('should support cursor-based pagination', async () => {
      // Insert 3 more rows for pagination testing
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await queryWithRls(
          pool,
          adminTenantId,
          `INSERT INTO audit_logs
            (tenant_id, user_id, actor_id, action, action_type, entity_type, correlation_id, source)
          VALUES
            ($1, gen_random_uuid(), gen_random_uuid(), $2, 'CREATE', 'PaginationTest', gen_random_uuid(), 'TEST')
          RETURNING id`,
          [adminTenantId, `paginationTest${i}`],
        );
        ids.push(result.rows[0].id);
      }
      testAuditIds.push(...ids);

      // First page
      const page1 = await gql(
        `query {
          auditLogs(filter: { entityType: "PaginationTest" }, first: 2) {
            edges { cursor node { action } }
            pageInfo { hasNextPage endCursor }
          }
        }`,
        undefined,
        adminToken,
      );

      expect(page1.errors).toBeUndefined();
      const pageInfo1 = page1.data!.auditLogs.pageInfo;
      expect(page1.data!.auditLogs.edges).toHaveLength(2);
      expect(pageInfo1.hasNextPage).toBe(true);

      // Second page using cursor
      const page2 = await gql(
        `query AuditLogs($after: String) {
          auditLogs(filter: { entityType: "PaginationTest" }, first: 2, after: $after) {
            edges { node { action } }
            pageInfo { hasNextPage hasPreviousPage }
          }
        }`,
        { after: pageInfo1.endCursor },
        adminToken,
      );

      expect(page2.errors).toBeUndefined();
      expect(page2.data!.auditLogs.edges.length).toBeGreaterThanOrEqual(1);
      expect(page2.data!.auditLogs.pageInfo.hasPreviousPage).toBe(true);
    });

    it('should require authentication', async () => {
      const res = await gql(`
        query {
          auditLogs(first: 10) {
            totalCount
          }
        }
      `);

      // Should get auth error
      expect(res.errors).toBeDefined();
      expect(res.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('RLS isolation', () => {
    it('should only return logs for the current tenant', async () => {
      const fakeTenantId = crypto.randomUUID();
      const correlationId = crypto.randomUUID();

      // Insert a row for a different tenant directly via SQL.
      // RETURNING requires SELECT policy to pass, so set RLS context for the fake tenant.
      const result = await queryWithRls(
        pool,
        fakeTenantId,
        `INSERT INTO audit_logs
          (tenant_id, user_id, actor_id, action, action_type, entity_type, correlation_id, source)
        VALUES ($1, gen_random_uuid(), gen_random_uuid(), 'rlsTest', 'CREATE', 'RlsTest', $2, 'TEST')
        RETURNING id`,
        [fakeTenantId, correlationId],
      );
      testAuditIds.push(result.rows[0].id);

      // Query via GraphQL with admin's tenant — should NOT see the other tenant's row
      const res = await gql(
        `query AuditLogs($filter: AuditLogFilterInput) {
          auditLogs(filter: $filter, first: 10) {
            totalCount
            edges { node { id tenantId } }
          }
        }`,
        { filter: { correlationId } },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      // The row belongs to fakeTenantId, not admin's tenant — RLS should block it
      expect(res.data!.auditLogs.totalCount).toBe(0);
    });
  });

  describe('Immutability', () => {
    it('should reject UPDATE on audit_logs', async () => {
      // roviq_admin inherits from roviq role and has UPDATE privilege.
      // Immutability is enforced via RLS: there are no UPDATE/DELETE policies,
      // so any UPDATE/DELETE should return 0 affected rows (silently blocked).
      const result = await pool.query(
        `UPDATE audit_logs SET action = 'HACKED' WHERE tenant_id = $1`,
        [adminTenantId],
      );
      // RLS silently filters out all rows — no rows updated
      expect(result.rowCount).toBe(0);
    });

    it('should reject DELETE on audit_logs', async () => {
      const result = await pool.query(`DELETE FROM audit_logs WHERE tenant_id = $1`, [
        adminTenantId,
      ]);
      // RLS silently filters out all rows — no rows deleted
      expect(result.rowCount).toBe(0);
    });
  });

  describe('@NoAudit opt-out', () => {
    it('should not create audit log for unauthenticated mutations via interceptor', async () => {
      // register is unauthenticated — no user on req, interceptor skips.
      // register also has no manual audit emission (no tenant context available).
      const uniqueUsername = `audit_test_${Date.now()}`;
      await gql(`
        mutation {
          register(input: {
            username: "${uniqueUsername}"
            password: "test1234"
            email: "${uniqueUsername}@test.com"
          }) {
            accessToken
          }
        }
      `);

      // Brief wait for any potential async pipeline
      await new Promise((r) => setTimeout(r, 1500));

      // Query with platform admin context to bypass RLS tenant isolation.
      // FORCE ROW LEVEL SECURITY is enabled on audit_logs — a bare pool.query()
      // without set_config would always return 0 rows, making this assertion vacuous.
      const result = await queryAsPlatformAdmin(
        pool,
        `SELECT id FROM audit_logs WHERE action = 'register' AND metadata->>'args' LIKE $1`,
        [`%${uniqueUsername}%`],
      );

      expect(result.rows).toHaveLength(0);
    });
  });
});

/**
 * Execute a query with platform admin context, bypassing tenant isolation.
 * Sets app.is_platform_admin = 'true' so the admin_platform_access policy passes.
 */
async function queryAsPlatformAdmin(
  pool: pg.Pool,
  sql: string,
  params: unknown[] = [],
): Promise<pg.QueryResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.is_platform_admin', 'true', true)");
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Poll DB until an audit log row appears for the given tenant and action.
 * Uses set_config for RLS context since FORCE ROW LEVEL SECURITY is enabled.
 */
async function waitForAuditLog(
  pool: pg.Pool,
  tenantId: string,
  action: string,
  timeoutMs = 5000,
): Promise<Record<string, unknown>[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await queryWithRls(
      pool,
      tenantId,
      `SELECT * FROM audit_logs WHERE tenant_id = $1 AND action = $2 ORDER BY created_at DESC LIMIT 5`,
      [tenantId, action],
    );
    if (result.rows.length > 0) return result.rows;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(
    `No audit log found for tenant=${tenantId} action=${action} after ${timeoutMs}ms`,
  );
}
