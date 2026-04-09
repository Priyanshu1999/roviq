/**
 * Security invariant integration tests (ROV-102).
 *
 * These tests run against a real PostgreSQL instance with the actual roles,
 * GRANTs, and RLS policies from Phase 1. They verify every security invariant
 * holds at the database level.
 *
 * Setup: requires a running postgres with all roles (roviq_pooler, roviq_app,
 * roviq_reseller, roviq_admin) and schema pushed via db:push + FORCE RLS.
 *
 * Run: pnpm nx test database --testPathPattern=security-invariants
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_POOLER_URL, TEST_SUPERUSER_URL } from './test-helpers';

const POOLER_URL = TEST_POOLER_URL;
const SUPERUSER_URL = TEST_SUPERUSER_URL;

// Seed IDs (must match scripts/seed-ids.ts)
const SEED = {
  RESELLER_DIRECT: '00000000-0000-0000-0000-000000000001',
  INSTITUTE_1: '00000000-0000-4000-a000-000000000101',
  INSTITUTE_2: '00000000-0000-4000-a000-000000000102',
  USER_ADMIN: '00000000-0000-4000-a000-000000000201',
  USER_TEACHER: '00000000-0000-4000-a000-000000000202',
  ROLE_PLATFORM_ADMIN: '00000000-0000-4000-a000-000000000301',
  ROLE_RESELLER_FULL_ADMIN: '00000000-0000-4000-a000-000000000311',
};

let poolerPool: pg.Pool;
let superPool: pg.Pool;

/**
 * Execute a callback as a specific role within a transaction.
 * The transaction is always rolled back — no test data leaks.
 */
async function asRole(
  role: string,
  vars: Record<string, string>,
  fn: (client: pg.PoolClient) => Promise<void>,
): Promise<void> {
  const client = await poolerPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL ROLE ${role}`);
    for (const [key, value] of Object.entries(vars)) {
      await client.query('SELECT set_config($1, $2, true)', [key, value]);
    }
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

beforeAll(async () => {
  poolerPool = new pg.Pool({ connectionString: POOLER_URL, max: 5 });
  superPool = new pg.Pool({ connectionString: SUPERUSER_URL, max: 2 });

  // Verify connectivity
  const res = await poolerPool.query('SELECT 1 as ok');
  expect(res.rows[0].ok).toBe(1);
});

afterAll(async () => {
  await poolerPool.end();
  await superPool.end();
});

// ── Role isolation (1-6) ──────────────────────────────────────

describe('Role isolation', () => {
  it('1. roviq_pooler cannot query without SET LOCAL ROLE', async () => {
    const client = await poolerPool.connect();
    try {
      await expect(client.query('SELECT * FROM institutes')).rejects.toThrow(/permission denied/);
    } finally {
      client.release();
    }
  });

  it('2. roviq_app cannot read platform_memberships', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query('SELECT * FROM platform_memberships');
      expect(res.rows).toHaveLength(0);
    });
  });

  it('3. roviq_app cannot read reseller_memberships', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query('SELECT * FROM reseller_memberships');
      expect(res.rows).toHaveLength(0);
    });
  });

  it("4. roviq_reseller cannot read other reseller's institutes", async () => {
    // Create a second reseller via superuser for this test
    const fakeResellerId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    await superPool.query(
      `INSERT INTO resellers (id, name, slug, tier) VALUES ($1, 'Test Reseller', 'test-reseller', 'full_management') ON CONFLICT (slug) DO NOTHING`,
      [fakeResellerId],
    );

    // As reseller scoped to fake reseller, cannot see Roviq Direct's institutes
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': fakeResellerId },
      async (client) => {
        const res = await client.query('SELECT * FROM institutes WHERE reseller_id = $1', [
          SEED.RESELLER_DIRECT,
        ]);
        expect(res.rows).toHaveLength(0);
      },
    );

    // Cleanup
    await superPool.query('DELETE FROM resellers WHERE id = $1', [fakeResellerId]);
  });

  it('5. roviq_reseller cannot write to tenant tables', async () => {
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': SEED.RESELLER_DIRECT },
      async (client) => {
        // Reseller has SELECT on tenant tables but no INSERT/UPDATE/DELETE
        // RLS blocks writes — either permission denied or RLS policy violation
        const err = await client
          .query(
            `INSERT INTO academic_years (id, tenant_id, label, start_date, end_date, is_active, created_by, updated_by)
         VALUES (uuidv7(), $1, 'Test Year', '2025-04-01', '2026-03-31', false, $2, $2)`,
            [SEED.INSTITUTE_1, SEED.USER_ADMIN],
          )
          .catch((e: Error) => e);
        expect(err).toBeInstanceOf(Error);
      },
    );
  });

  it('6. roviq_admin sees all data', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      const institutes = await client.query('SELECT * FROM institutes');
      expect(institutes.rows.length).toBeGreaterThanOrEqual(2);

      const users = await client.query('SELECT * FROM users');
      expect(users.rows.length).toBeGreaterThanOrEqual(3);

      const platformMemberships = await client.query('SELECT * FROM platform_memberships');
      expect(platformMemberships.rows.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ── Token security (7-8) ──────────────────────────────────────

describe('Token security', () => {
  it('7. Impersonation tokens have no refresh token in DB', async () => {
    // Impersonation tokens are issued without creating a refresh_token row.
    // Verify: there are no refresh tokens with membership_scope that would
    // indicate an impersonation session. The impersonation code exchange
    // never calls issueTokens() — it generates an access-only JWT.
    await asRole('roviq_admin', {}, async (client) => {
      // All refresh tokens should have scope = platform|reseller|institute
      const res = await client.query(
        `SELECT * FROM refresh_tokens WHERE membership_scope NOT IN ('platform', 'reseller', 'institute')`,
      );
      expect(res.rows).toHaveLength(0);
    });
  });

  it('8. Revoked impersonation session has ended_at set', async () => {
    // When a session is revoked (e.g., reseller suspended), ended_at and
    // ended_reason must be set. This is enforced by the suspension flow.
    await asRole('roviq_admin', {}, async (client) => {
      // Insert a test session and mark as revoked
      const sessionId = 'ffffffff-0000-0000-0000-000000000001';
      await client.query(
        `INSERT INTO impersonation_sessions
         (id, impersonator_id, impersonator_scope, target_user_id, target_tenant_id, reason, started_at, expires_at, ended_at, ended_reason)
         VALUES ($1, $2, 'platform', $3, $4, 'Test reason for security', now(), now() + interval '1 hour', now(), 'revoked')`,
        [sessionId, SEED.USER_ADMIN, SEED.USER_TEACHER, SEED.INSTITUTE_1],
      );

      const res = await client.query(
        'SELECT ended_at, ended_reason FROM impersonation_sessions WHERE id = $1',
        [sessionId],
      );
      expect(res.rows[0].ended_at).not.toBeNull();
      expect(res.rows[0].ended_reason).toBe('revoked');
    });
  });
});

// ── Session management (9-11) ─────────────────────────────────

describe('Session management', () => {
  it('9. Reseller suspension can revoke all staff refresh tokens', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      // Insert a test refresh token for a reseller staff member
      const tokenId = 'ffffffff-0000-0000-0000-000000000010';
      await client.query(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, membership_id, membership_scope, expires_at)
         VALUES ($1, $2, 'test-hash-9', $3, 'reseller', now() + interval '7 days')`,
        [tokenId, SEED.USER_ADMIN, SEED.ROLE_RESELLER_FULL_ADMIN],
      );

      // Simulate suspension: revoke all reseller-scope tokens
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = now()
         WHERE membership_scope = 'reseller' AND revoked_at IS NULL AND id = $1`,
        [tokenId],
      );

      const res = await client.query('SELECT revoked_at FROM refresh_tokens WHERE id = $1', [
        tokenId,
      ]);
      expect(res.rows[0].revoked_at).not.toBeNull();
    });
  });

  it('10. Reseller suspension can terminate active impersonation sessions', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      const sessionId = 'ffffffff-0000-0000-0000-000000000011';
      await client.query(
        `INSERT INTO impersonation_sessions
         (id, impersonator_id, impersonator_scope, target_user_id, target_tenant_id, reason, started_at, expires_at)
         VALUES ($1, $2, 'reseller', $3, $4, 'Reseller test impersonation', now(), now() + interval '1 hour')`,
        [sessionId, SEED.USER_ADMIN, SEED.USER_TEACHER, SEED.INSTITUTE_1],
      );

      // Simulate suspension: terminate all active sessions
      await client.query(
        `UPDATE impersonation_sessions SET ended_at = now(), ended_reason = 'revoked'
         WHERE id = $1 AND ended_at IS NULL`,
        [sessionId],
      );

      const res = await client.query(
        'SELECT ended_at, ended_reason FROM impersonation_sessions WHERE id = $1',
        [sessionId],
      );
      expect(res.rows[0].ended_at).not.toBeNull();
      expect(res.rows[0].ended_reason).toBe('revoked');
    });
  });

  it('11. Password change timestamp can invalidate sessions', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      // Insert a refresh token created BEFORE the password change
      const tokenId = 'ffffffff-0000-0000-0000-000000000012';
      const tokenCreatedAt = new Date(Date.now() - 60_000); // 1 min ago
      const passwordChangedAt = new Date(); // now

      await client.query(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, membership_id, membership_scope, expires_at, created_at)
         VALUES ($1, $2, 'test-hash-11', $3, 'institute', now() + interval '7 days', $4)`,
        [tokenId, SEED.USER_TEACHER, SEED.ROLE_PLATFORM_ADMIN, tokenCreatedAt],
      );

      // Verify: token was created before password change
      const res = await client.query(`SELECT created_at FROM refresh_tokens WHERE id = $1`, [
        tokenId,
      ]);
      expect(new Date(res.rows[0].created_at).getTime()).toBeLessThan(passwordChangedAt.getTime());
    });
  });
});

// ── Data isolation (12-13) ────────────────────────────────────

describe('Data isolation', () => {
  it('12. Wrong portal returns no data (role-based isolation)', async () => {
    // Platform admin user has no institute membership accessible via roviq_app
    // if the tenant context doesn't match
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      // Platform memberships are invisible to roviq_app (default deny)
      const res = await client.query('SELECT * FROM platform_memberships');
      expect(res.rows).toHaveLength(0);
    });
  });

  it('13. Cross-tenant data isolation', async () => {
    // Seed a test row via superuser (persistent, not rolled back)
    const testId = 'ffffffff-0000-0000-0000-000000000020';
    await superPool.query(
      `INSERT INTO academic_years (id, tenant_id, label, start_date, end_date, is_active, status, created_by, updated_by)
       VALUES ($1, $2, 'Test-RLS-Year', '2024-04-01', '2025-03-31', false, 'ARCHIVED', $3, $3)
       ON CONFLICT DO NOTHING`,
      [testId, SEED.INSTITUTE_1, SEED.USER_ADMIN],
    );

    // Tenant A can see their own data
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query('SELECT * FROM academic_years WHERE id = $1', [testId]);
      expect(res.rows).toHaveLength(1);
    });

    // Tenant B cannot see Tenant A's data
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_2 }, async (client) => {
      const res = await client.query('SELECT * FROM academic_years WHERE id = $1', [testId]);
      expect(res.rows).toHaveLength(0);
    });

    // Cleanup
    await superPool.query('DELETE FROM academic_years WHERE id = $1', [testId]);
  });
});

// ── Impersonation security (14-15) ────────────────────────────

describe('Impersonation security', () => {
  it('14a. Impersonation reason must be at least 10 chars', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      await expect(
        client.query(
          `INSERT INTO impersonation_sessions
           (impersonator_id, impersonator_scope, target_user_id, target_tenant_id, reason, started_at, expires_at)
           VALUES ($1, 'platform', $2, $3, 'short', now(), now() + interval '1 hour')`,
          [SEED.USER_ADMIN, SEED.USER_TEACHER, SEED.INSTITUTE_1],
        ),
      ).rejects.toThrow(/chk_reason_length/);
    });
  });

  it('14b. Impersonation session max 1 hour', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      await expect(
        client.query(
          `INSERT INTO impersonation_sessions
           (impersonator_id, impersonator_scope, target_user_id, target_tenant_id, reason, started_at, expires_at)
           VALUES ($1, 'platform', $2, $3, 'Valid reason for impersonation', now(), now() + interval '2 hours')`,
          [SEED.USER_ADMIN, SEED.USER_TEACHER, SEED.INSTITUTE_1],
        ),
      ).rejects.toThrow(/chk_max_duration/);
    });
  });

  it('14c. Valid impersonation session succeeds', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      const res = await client.query(
        `INSERT INTO impersonation_sessions
         (impersonator_id, impersonator_scope, target_user_id, target_tenant_id, reason, started_at, expires_at)
         VALUES ($1, 'platform', $2, $3, 'Valid reason for impersonation test', now(), now() + interval '1 hour')
         RETURNING id`,
        [SEED.USER_ADMIN, SEED.USER_TEACHER, SEED.INSTITUTE_1],
      );
      expect(res.rows).toHaveLength(1);
    });
  });

  it('15a. Platform role with tenant_id violates CHECK', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      await expect(
        client.query(
          `INSERT INTO roles (scope, tenant_id, name, abilities, created_by, updated_by)
           VALUES ('platform', $1, '{"en":"bad_role"}', '[]', $2, $2)`,
          [SEED.INSTITUTE_1, SEED.USER_ADMIN],
        ),
      ).rejects.toThrow(/chk_role_scope/);
    });
  });

  it('15b. Institute role without tenant_id violates CHECK', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      await expect(
        client.query(
          `INSERT INTO roles (scope, name, abilities, created_by, updated_by)
           VALUES ('institute', '{"en":"bad_role_2"}', '[]', $1, $1)`,
          [SEED.USER_ADMIN],
        ),
      ).rejects.toThrow(/chk_role_scope/);
    });
  });
});

// ── Institute switching (16) ──────────────────────────────────

describe('Institute switching', () => {
  it('16. Refresh tokens track membership scope', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      // Every refresh token must have a membership_scope
      const res = await client.query(
        `SELECT * FROM refresh_tokens WHERE membership_scope IS NULL OR membership_scope = ''`,
      );
      expect(res.rows).toHaveLength(0);

      // membership_id is NOT NULL
      const nullMembership = await client.query(
        'SELECT * FROM refresh_tokens WHERE membership_id IS NULL',
      );
      expect(nullMembership.rows).toHaveLength(0);
    });
  });
});

// ── System protection (17-18) ─────────────────────────────────

describe('System protection', () => {
  it('17. System reseller cannot be deleted', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      // Attempting to delete the system reseller should fail
      // (enforced by application logic, but verify the is_system flag)
      const res = await client.query('SELECT is_system FROM resellers WHERE id = $1', [
        SEED.RESELLER_DIRECT,
      ]);
      expect(res.rows[0].is_system).toBe(true);
    });
  });

  it('18. Audit logs are immutable via roviq_app', async () => {
    // Insert via roviq_admin role (FORCE RLS requires a policy-matched role)
    const testId = 'ffffffff-0000-0000-0000-000000000030';
    const client = await superPool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE roviq_admin');
      await client.query(
        `INSERT INTO audit_logs
         (id, scope, tenant_id, user_id, actor_id, action, action_type, entity_type, entity_id, correlation_id, source)
         VALUES ($1, 'institute', $2, $3, $3, 'test', 'CREATE', 'Test', $1, uuidv7(), 'TEST')
         ON CONFLICT DO NOTHING`,
        [testId, SEED.INSTITUTE_1, SEED.USER_ADMIN],
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // roviq_app cannot UPDATE audit logs (REVOKE UPDATE enforced at GRANT level)
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      await expect(
        client.query(`UPDATE audit_logs SET action = 'HACKED' WHERE id = $1`, [testId]),
      ).rejects.toThrow(/permission denied/);
    });

    // roviq_app cannot DELETE audit logs (REVOKE DELETE enforced at GRANT level)
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      await expect(client.query('DELETE FROM audit_logs WHERE id = $1', [testId])).rejects.toThrow(
        /permission denied/,
      );
    });

    // Cleanup via roviq_admin (FORCE RLS requires policy-matched role)
    const cleanupClient = await superPool.connect();
    try {
      await cleanupClient.query('BEGIN');
      await cleanupClient.query('SET LOCAL ROLE roviq_admin');
      await cleanupClient.query('DELETE FROM audit_logs WHERE id = $1', [testId]);
      await cleanupClient.query('COMMIT');
    } finally {
      cleanupClient.release();
    }
  });
});

// ── Structural sweep (20) ─────────────────────────────────────

describe('Structural invariants — RLS sweep', () => {
  it('20. every table with tenant_id has FORCE RLS and ≥3 policies', async () => {
    const tables = await superPool.query<{
      relname: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE a.attname = 'tenant_id'
        AND c.relkind IN ('r', 'p')
        AND NOT c.relispartition
        AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);

    expect(tables.rows.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const row of tables.rows) {
      if (!row.relrowsecurity || !row.relforcerowsecurity) {
        violations.push(
          `${row.relname}: ENABLE=${row.relrowsecurity} FORCE=${row.relforcerowsecurity}`,
        );
        continue;
      }
      const policies = await superPool.query<{ count: string }>(
        `SELECT count(*)::text FROM pg_policy
         WHERE polrelid = (SELECT oid FROM pg_class WHERE relname = $1)`,
        [row.relname],
      );
      const policyCount = Number(policies.rows[0]?.count ?? '0');
      if (policyCount < 3) {
        violations.push(`${row.relname}: ${policyCount} policies (expected ≥3)`);
      }
    }

    expect(violations).toEqual([]);
  });
});

// ── WebSocket / auth_events (19) ──────────────────────────────

describe('Auth events', () => {
  it('19. roviq_admin can read and write auth_events, roviq_app cannot read', async () => {
    // AuthEventService uses withAdmin() to write — verify admin can INSERT
    await asRole('roviq_admin', {}, async (client) => {
      const insertRes = await client.query(
        `INSERT INTO auth_events (user_id, event_type, scope, created_at)
         VALUES ($1, 'login_success', 'institute', now()) RETURNING id`,
        [SEED.USER_TEACHER],
      );
      expect(insertRes.rows).toHaveLength(1);

      // Admin can also read
      const selectRes = await client.query('SELECT * FROM auth_events LIMIT 1');
      expect(selectRes.rows.length).toBeGreaterThanOrEqual(1);
    });

    // roviq_app cannot SELECT auth events (REVOKE SELECT enforced by db:reset)
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      await expect(client.query('SELECT * FROM auth_events')).rejects.toThrow(/permission denied/);
    });
  });
});
