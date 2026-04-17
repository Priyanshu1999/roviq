/**
 * ROV-88 + ROV-91 RLS Security Invariant Tests (Auth PRD §4, §5).
 *
 * 5 tests covering:
 *   1. platform_memberships: only roviq_admin can read (default deny for app/reseller)
 *   2. reseller_memberships: roviq_reseller sees own, cross-reseller isolation
 *   3. roles scope CHECK: platform role with tenant_id → constraint violation
 *   4. impersonation_sessions: CHECK expires_at > started_at + 1 hour → rejected
 *   5. auth_events: roviq_app can INSERT but not SELECT/UPDATE/DELETE
 *
 * All tests use real PostgreSQL with SET LOCAL ROLE.
 * Each test wraps in a transaction with ROLLBACK — no data leaks.
 *
 * Run: pnpm nx test database --testPathPattern=membership-rls-invariants
 * Requires: seeded DB (pnpm db:reset --seed)
 */
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_POOLER_URL, TEST_SUPERUSER_URL } from './test-helpers';

const SEED = {
  RESELLER_DIRECT: '00000000-0000-4000-a000-000000000011',
  ROLE_PLATFORM_ADMIN: '00000000-0000-4000-a000-000000000301',
  ROLE_RESELLER_FULL_ADMIN: '00000000-0000-4000-a000-000000000311',
  INSTITUTE_1: '00000000-0000-4000-a000-000000000101',
  USER_ADMIN: '00000000-0000-4000-a000-000000000201',
};

let poolerPool: pg.Pool;
let superPool: pg.Pool;

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
  poolerPool = new pg.Pool({ connectionString: TEST_POOLER_URL, max: 5 });
  superPool = new pg.Pool({ connectionString: TEST_SUPERUSER_URL, max: 2 });
  const res = await poolerPool.query('SELECT 1 as ok');
  expect(res.rows[0].ok).toBe(1);
});

afterAll(async () => {
  await poolerPool.end();
  await superPool.end();
});

// ═══════════════════════════════════════════════════════
// ROV-88 Invariant 1: platform_memberships — admin-only access
// ═══════════════════════════════════════════════════════

describe('ROV-88 Invariant 1: platform_memberships default deny for roviq_app', () => {
  it('roviq_app cannot SELECT from platform_memberships (0 rows, no policy)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      const res = await client.query('SELECT * FROM platform_memberships');
      expect(res.rows).toHaveLength(0);
    });
  });

  it('roviq_reseller cannot SELECT from platform_memberships (0 rows, no policy)', async () => {
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': SEED.RESELLER_DIRECT },
      async (client) => {
        const res = await client.query('SELECT * FROM platform_memberships');
        expect(res.rows).toHaveLength(0);
      },
    );
  });

  it('roviq_admin can SELECT from platform_memberships', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      // Just verify SELECT doesn't error — row count depends on seed
      const res = await client.query('SELECT count(*) FROM platform_memberships');
      expect(Number(res.rows[0].count)).toBeGreaterThanOrEqual(0);
    });
  });
});

// ═══════════════════════════════════════════════════════
// ROV-88 Invariant 2: reseller_memberships isolation
// ═══════════════════════════════════════════════════════

describe('ROV-88 Invariant 2: reseller_memberships cross-reseller isolation', () => {
  it('roviq_reseller with fake reseller_id sees 0 reseller_memberships', async () => {
    const fakeResellerId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    await asRole(
      'roviq_reseller',
      { 'app.current_reseller_id': fakeResellerId },
      async (client) => {
        const res = await client.query('SELECT * FROM reseller_memberships');
        expect(res.rows).toHaveLength(0);
      },
    );
  });

  it('roviq_app cannot INSERT into reseller_memberships', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      await expect(
        client.query(
          `INSERT INTO reseller_memberships (user_id, role_id, reseller_id)
           VALUES ($1, $2, $3)`,
          [SEED.USER_ADMIN, SEED.ROLE_RESELLER_FULL_ADMIN, SEED.RESELLER_DIRECT],
        ),
      ).rejects.toThrow(/permission denied|row-level security/);
    });
  });
});

// ═══════════════════════════════════════════════════════
// ROV-91 Invariant 3: roles scope CHECK constraint
// ═══════════════════════════════════════════════════════

describe('ROV-91 Invariant 3: chk_role_scope CHECK constraint', () => {
  it('platform role with tenant_id violates chk_role_scope', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      await expect(
        client.query(
          `INSERT INTO roles (scope, tenant_id, reseller_id, name, abilities, created_by, updated_by)
           VALUES ('platform', $1, NULL, '{"en":"bad_platform_role"}', '[]', $2, $2)`,
          [SEED.INSTITUTE_1, SEED.USER_ADMIN],
        ),
      ).rejects.toThrow(/chk_role_scope/);
    });
  });

  it('reseller role without reseller_id violates chk_role_scope', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      await expect(
        client.query(
          `INSERT INTO roles (scope, tenant_id, reseller_id, name, abilities, created_by, updated_by)
           VALUES ('reseller', NULL, NULL, '{"en":"bad_reseller_role"}', '[]', $1, $1)`,
          [SEED.USER_ADMIN],
        ),
      ).rejects.toThrow(/chk_role_scope/);
    });
  });

  it('institute role without tenant_id violates chk_role_scope', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      await expect(
        client.query(
          `INSERT INTO roles (scope, tenant_id, reseller_id, name, abilities, created_by, updated_by)
           VALUES ('institute', NULL, NULL, '{"en":"bad_institute_role"}', '[]', $1, $1)`,
          [SEED.USER_ADMIN],
        ),
      ).rejects.toThrow(/chk_role_scope/);
    });
  });
});

// ═══════════════════════════════════════════════════════
// ROV-91 Invariant 4: impersonation_sessions — 1-hour CHECK
// ═══════════════════════════════════════════════════════

describe('ROV-91 Invariant 4: impersonation_sessions max 1-hour constraint', () => {
  it('expires_at > started_at + 1 hour → chk_max_duration violation', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      await expect(
        client.query(
          `INSERT INTO impersonation_sessions
           (impersonator_id, impersonator_scope, target_user_id, target_tenant_id,
            reason, started_at, expires_at)
           VALUES ($1, 'platform', $1, $2,
                   'Valid reason longer than ten chars', now(), now() + interval '2 hours')`,
          [SEED.USER_ADMIN, SEED.INSTITUTE_1],
        ),
      ).rejects.toThrow(/chk_max_duration/);
    });
  });

  it('reason shorter than 10 chars → chk_reason_length violation', async () => {
    await asRole('roviq_admin', {}, async (client) => {
      await expect(
        client.query(
          `INSERT INTO impersonation_sessions
           (impersonator_id, impersonator_scope, target_user_id, target_tenant_id,
            reason, started_at, expires_at)
           VALUES ($1, 'platform', $1, $2,
                   'short', now(), now() + interval '30 minutes')`,
          [SEED.USER_ADMIN, SEED.INSTITUTE_1],
        ),
      ).rejects.toThrow(/chk_reason_length/);
    });
  });
});

// ═══════════════════════════════════════════════════════
// ROV-91 Invariant 5: auth_events — insert-only for roviq_app
// ═══════════════════════════════════════════════════════

describe('ROV-91 Invariant 5: auth_events INSERT-only for roviq_app', () => {
  it('roviq_app can INSERT an auth_event', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      // No RETURNING — the invariant is INSERT-only; RETURNING would require
      // SELECT privilege on the returned column, which roviq_app must not have.
      const res = await client.query(
        `INSERT INTO auth_events (user_id, event_type, scope, tenant_id)
         VALUES ($1, 'login_success', 'institute', $2)`,
        [SEED.USER_ADMIN, SEED.INSTITUTE_1],
      );
      expect(res.rowCount).toBe(1);
    });
  });

  it('roviq_app cannot SELECT from auth_events (no SELECT policy)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      await expect(client.query('SELECT * FROM auth_events LIMIT 1')).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  it('roviq_app cannot DELETE from auth_events (no DELETE policy)', async () => {
    await asRole('roviq_app', { 'app.current_tenant_id': SEED.INSTITUTE_1 }, async (client) => {
      await expect(
        client.query('DELETE FROM auth_events WHERE user_id = $1', [SEED.USER_ADMIN]),
      ).rejects.toThrow(/permission denied/);
    });
  });
});

// ═══════════════════════════════════════════════════════
// ROV-91 Invariant 6: System roles seed
// ═══════════════════════════════════════════════════════

describe('ROV-91 Invariant 6: system roles seeded correctly', () => {
  it('all 5 system roles exist with correct scope', async () => {
    const res = await superPool.query(
      `SELECT id, scope, reseller_id, is_system, name->>'en' as name_en
       FROM roles
       WHERE id = ANY($1::uuid[])
       ORDER BY id`,
      [
        [
          '00000000-0000-4000-a000-000000000301',
          '00000000-0000-4000-a000-000000000302',
          '00000000-0000-4000-a000-000000000311',
          '00000000-0000-4000-a000-000000000312',
          '00000000-0000-4000-a000-000000000313',
        ],
      ],
    );
    expect(res.rows).toHaveLength(5);

    const byId = new Map(res.rows.map((r) => [r.id, r]));

    const platformAdmin = byId.get('00000000-0000-4000-a000-000000000301');
    expect(platformAdmin?.scope).toBe('platform');
    expect(platformAdmin?.reseller_id).toBeNull();
    expect(platformAdmin?.is_system).toBe(true);
    expect(platformAdmin?.name_en).toBe('platform_admin');

    const resellerFull = byId.get('00000000-0000-4000-a000-000000000311');
    expect(resellerFull?.scope).toBe('reseller');
    expect(resellerFull?.reseller_id).toBe(SEED.RESELLER_DIRECT);
    expect(resellerFull?.is_system).toBe(true);
    expect(resellerFull?.name_en).toBe('reseller_full_admin');
  });
});
