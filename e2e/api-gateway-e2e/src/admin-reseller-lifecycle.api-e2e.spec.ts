/**
 * Admin reseller lifecycle E2E (ROV-97).
 *
 * Covers the full suspend → unsuspend → delete state machine against a
 * throwaway test reseller created via superuser DB access. The system reseller
 * "Roviq Direct" rejection cases are already covered in
 * security-invariants.api-e2e.spec.ts (#18); this file exercises the happy
 * path + state guards.
 */
import assert from 'node:assert';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginAsPlatformAdmin } from './helpers/auth';
import { gql } from './helpers/gql-client';

// Superuser URL required — RLS would otherwise block writes to the
// resellers table under the pooler role. Matches the pattern in
// audit.api-e2e.spec.ts but uses the `roviq` superuser.
const SUPERUSER_URL =
  process.env.DATABASE_URL_E2E_MIGRATE ??
  process.env.DATABASE_URL_MIGRATE ??
  'postgresql://roviq:roviq_dev@localhost:5435/roviq_test';

// Fixed test UUIDs so re-runs are idempotent (we DELETE by ID in afterAll).
const TEST_RESELLER_ID = 'ffffffff-f000-4000-a000-000000000101';
const TEST_RESELLER_ID_FOR_DELETE = 'ffffffff-f000-4000-a000-000000000102';

async function insertTestReseller(
  pool: pg.Pool,
  id: string,
  slug: string,
  opts: { suspendedDaysAgo?: number } = {},
): Promise<void> {
  const status = opts.suspendedDaysAgo !== undefined ? 'SUSPENDED' : 'ACTIVE';
  const suspendedAt =
    opts.suspendedDaysAgo !== undefined
      ? new Date(Date.now() - opts.suspendedDaysAgo * 24 * 60 * 60 * 1000)
      : null;

  await pool.query(
    `INSERT INTO resellers (id, name, slug, tier, is_system, is_active, status, suspended_at)
     VALUES ($1, $2, $3, 'FULL_MANAGEMENT', false, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE
       SET status = EXCLUDED.status,
           is_active = EXCLUDED.is_active,
           suspended_at = EXCLUDED.suspended_at,
           deleted_at = NULL`,
    [id, `Test Reseller ${id.slice(-4)}`, slug, status === 'ACTIVE', status, suspendedAt],
  );
}

async function deleteTestReseller(pool: pg.Pool, id: string): Promise<void> {
  // Remove any dependent rows first — test reseller should have none, but defensive.
  await pool.query('DELETE FROM reseller_memberships WHERE reseller_id = $1', [id]);
  await pool.query('DELETE FROM resellers WHERE id = $1', [id]);
}

async function getResellerStatus(
  pool: pg.Pool,
  id: string,
): Promise<{
  status: string;
  isActive: boolean;
  suspendedAt: Date | null;
  deletedAt: Date | null;
}> {
  const res = await pool.query<{
    status: string;
    is_active: boolean;
    suspended_at: Date | null;
    deleted_at: Date | null;
  }>('SELECT status, is_active, suspended_at, deleted_at FROM resellers WHERE id = $1', [id]);
  const row = res.rows[0];
  assert(row, `reseller ${id} not found`);
  return {
    status: row.status,
    isActive: row.is_active,
    suspendedAt: row.suspended_at,
    deletedAt: row.deleted_at,
  };
}

describe('Admin Reseller Lifecycle E2E (ROV-97)', () => {
  let pool: pg.Pool;
  let adminToken: string;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: SUPERUSER_URL, max: 3 });
    const admin = await loginAsPlatformAdmin();
    adminToken = admin.accessToken;

    await insertTestReseller(pool, TEST_RESELLER_ID, `test-reseller-${TEST_RESELLER_ID.slice(-4)}`);
    await insertTestReseller(
      pool,
      TEST_RESELLER_ID_FOR_DELETE,
      `test-reseller-${TEST_RESELLER_ID_FOR_DELETE.slice(-4)}`,
      { suspendedDaysAgo: 40 },
    );
  });

  afterAll(async () => {
    await deleteTestReseller(pool, TEST_RESELLER_ID);
    await deleteTestReseller(pool, TEST_RESELLER_ID_FOR_DELETE);
    await pool.end();
  });

  // ── suspendReseller ─────────────────────────────────────────

  it('suspends an active reseller', async () => {
    const res = await gql<{ adminSuspendReseller: boolean }>(
      `mutation($id: String!, $reason: String) {
        adminSuspendReseller(resellerId: $id, reason: $reason)
      }`,
      { id: TEST_RESELLER_ID, reason: 'e2e lifecycle test' },
      adminToken,
    );

    expect(res.errors).toBeUndefined();
    assert(res.data);
    expect(res.data.adminSuspendReseller).toBe(true);

    const after = await getResellerStatus(pool, TEST_RESELLER_ID);
    expect(after.status).toBe('SUSPENDED');
    expect(after.isActive).toBe(false);
    expect(after.suspendedAt).not.toBeNull();
  });

  it('rejects suspending an already-suspended reseller', async () => {
    const res = await gql(
      `mutation($id: String!) { adminSuspendReseller(resellerId: $id) }`,
      { id: TEST_RESELLER_ID },
      adminToken,
    );

    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(/already suspended/i);
  });

  it('rejects suspending an unknown reseller', async () => {
    const res = await gql(
      `mutation($id: String!) { adminSuspendReseller(resellerId: $id) }`,
      { id: '00000000-0000-4000-a000-00000000dead' },
      adminToken,
    );

    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(/not found/i);
  });

  // ── unsuspendReseller ───────────────────────────────────────

  it('unsuspends a suspended reseller', async () => {
    const res = await gql<{ adminUnsuspendReseller: boolean }>(
      `mutation($id: String!) { adminUnsuspendReseller(resellerId: $id) }`,
      { id: TEST_RESELLER_ID },
      adminToken,
    );

    expect(res.errors).toBeUndefined();
    assert(res.data);
    expect(res.data.adminUnsuspendReseller).toBe(true);

    const after = await getResellerStatus(pool, TEST_RESELLER_ID);
    expect(after.status).toBe('ACTIVE');
    expect(after.isActive).toBe(true);
    expect(after.suspendedAt).toBeNull();
  });

  it('rejects unsuspending an active reseller', async () => {
    const res = await gql(
      `mutation($id: String!) { adminUnsuspendReseller(resellerId: $id) }`,
      { id: TEST_RESELLER_ID },
      adminToken,
    );

    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(/not suspended/i);
  });

  it('rejects unsuspending the system reseller', async () => {
    const res = await gql(
      `mutation($id: String!) { adminUnsuspendReseller(resellerId: $id) }`,
      { id: '00000000-0000-4000-a000-000000000011' },
      adminToken,
    );

    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(/system reseller|forbidden/i);
  });

  // ── deleteReseller — grace period ──────────────────────────

  it('rejects deleting a reseller that was suspended less than 30 days ago', async () => {
    // Reseller 1 was just unsuspended above — re-suspend it now (suspendedAt = now)
    await gql(
      `mutation($id: String!) { adminSuspendReseller(resellerId: $id) }`,
      { id: TEST_RESELLER_ID },
      adminToken,
    );

    const res = await gql(
      `mutation($id: String!) { adminDeleteReseller(resellerId: $id) }`,
      { id: TEST_RESELLER_ID },
      adminToken,
    );

    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(/grace period/i);
  });

  it('rejects deleting an active (non-suspended) reseller', async () => {
    // Flip back to active
    await gql(
      `mutation($id: String!) { adminUnsuspendReseller(resellerId: $id) }`,
      { id: TEST_RESELLER_ID },
      adminToken,
    );

    const res = await gql(
      `mutation($id: String!) { adminDeleteReseller(resellerId: $id) }`,
      { id: TEST_RESELLER_ID },
      adminToken,
    );

    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(/must be suspended/i);
  });

  // ── deleteReseller — happy path (pre-aged reseller) ────────

  it('deletes a reseller that has been suspended for 30+ days', async () => {
    const res = await gql<{ adminDeleteReseller: boolean }>(
      `mutation($id: String!) { adminDeleteReseller(resellerId: $id) }`,
      { id: TEST_RESELLER_ID_FOR_DELETE },
      adminToken,
    );

    expect(res.errors).toBeUndefined();
    assert(res.data);
    expect(res.data.adminDeleteReseller).toBe(true);

    const after = await getResellerStatus(pool, TEST_RESELLER_ID_FOR_DELETE);
    expect(after.status).toBe('DELETED');
    expect(after.deletedAt).not.toBeNull();
  });

  // ── ROV-234: adminListResellers ─────────────────────────────

  describe('adminListResellers (ROV-234)', () => {
    it('returns at least the system reseller + the active test reseller', async () => {
      // Make sure the first test reseller is active for this assertion
      await pool.query(
        `UPDATE resellers SET status='ACTIVE', is_active=true, suspended_at=NULL, deleted_at=NULL WHERE id=$1`,
        [TEST_RESELLER_ID],
      );

      const res = await gql<{
        adminListResellers: {
          totalCount: number;
          edges: Array<{ node: { id: string; slug: string; tier: string; status: string } }>;
        };
      }>(
        `query {
          adminListResellers(filter: { first: 50 }) {
            totalCount
            edges { node { id slug tier status isSystem instituteCount teamSize } }
          }
        }`,
        {},
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      const ids = res.data.adminListResellers.edges.map((e) => e.node.id);
      expect(ids).toContain('00000000-0000-4000-a000-000000000011'); // Roviq Direct
      expect(ids).toContain(TEST_RESELLER_ID);
      expect(res.data.adminListResellers.totalCount).toBeGreaterThanOrEqual(2);
    });

    it('filters by status (only SUSPENDED)', async () => {
      // Re-suspend the test reseller so this filter has a match
      await gql(
        `mutation($id: String!) { adminSuspendReseller(resellerId: $id, reason: "filter test") }`,
        { id: TEST_RESELLER_ID },
        adminToken,
      );

      const res = await gql<{
        adminListResellers: { edges: Array<{ node: { id: string; status: string } }> };
      }>(
        `query {
          adminListResellers(filter: { status: [SUSPENDED] }) {
            edges { node { id status } }
          }
        }`,
        {},
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      for (const edge of res.data.adminListResellers.edges) {
        expect(edge.node.status).toBe('SUSPENDED');
      }
    });

    it('filters by isSystem=true to isolate Roviq Direct', async () => {
      const res = await gql<{
        adminListResellers: { edges: Array<{ node: { id: string; isSystem: boolean } }> };
      }>(
        `query {
          adminListResellers(filter: { isSystem: true }) {
            edges { node { id isSystem } }
          }
        }`,
        {},
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminListResellers.edges.length).toBe(1);
      expect(res.data.adminListResellers.edges[0].node.isSystem).toBe(true);
    });
  });

  // ── ROV-234: adminGetReseller ───────────────────────────────

  describe('adminGetReseller (ROV-234)', () => {
    it('returns the reseller with computed counts', async () => {
      const res = await gql<{
        adminGetReseller: { id: string; slug: string; instituteCount: number; teamSize: number };
      }>(
        `query($id: ID!) {
          adminGetReseller(id: $id) {
            id slug tier status isSystem instituteCount teamSize
          }
        }`,
        { id: '00000000-0000-4000-a000-000000000011' },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminGetReseller.slug).toBe('roviq-direct');
      // Seed plants 2 institutes under Roviq Direct
      expect(res.data.adminGetReseller.instituteCount).toBeGreaterThanOrEqual(2);
    });

    it('returns RESELLER_INVALID for unknown id', async () => {
      const res = await gql(
        `query($id: ID!) { adminGetReseller(id: $id) { id } }`,
        { id: '00000000-0000-4000-a000-00000000dead' },
        adminToken,
      );
      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].extensions).toMatchObject({ code: expect.anything() });
    });
  });

  // ── ROV-234: adminCreateReseller / adminUpdateReseller / adminChangeResellerTier

  describe('adminCreateReseller (ROV-234)', () => {
    // Per-run unique slug so re-runs don't collide with each other
    const createdSlug = `e2e-acme-${Date.now().toString(36)}`;
    let createdId: string | null = null;

    afterAll(async () => {
      if (createdId) {
        await pool.query('DELETE FROM reseller_memberships WHERE reseller_id = $1', [createdId]);
        await pool.query('DELETE FROM resellers WHERE id = $1', [createdId]);
      }
    });

    it('creates a reseller + initial admin, returns the new row with tier=FULL_MANAGEMENT', async () => {
      const res = await gql<{
        adminCreateReseller: {
          id: string;
          slug: string;
          tier: string;
          status: string;
          isSystem: boolean;
        };
      }>(
        `mutation($input: AdminCreateResellerInput!) {
          adminCreateReseller(input: $input) {
            id slug tier status isSystem branding { primaryColor }
          }
        }`,
        {
          input: {
            name: `E2E Acme ${Date.now().toString(36)}`,
            slug: createdSlug,
            tier: 'FULL_MANAGEMENT',
            initialAdminEmail: `e2e-admin-${Date.now().toString(36)}@roviq.test`,
            branding: { primaryColor: '#1677FF' },
          },
        },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminCreateReseller.slug).toBe(createdSlug);
      expect(res.data.adminCreateReseller.tier).toBe('FULL_MANAGEMENT');
      expect(res.data.adminCreateReseller.status).toBe('ACTIVE');
      expect(res.data.adminCreateReseller.isSystem).toBe(false);
      createdId = res.data.adminCreateReseller.id;
    });

    it('rejects a duplicate slug with SLUG_DUPLICATE', async () => {
      const res = await gql(
        `mutation($input: AdminCreateResellerInput!) {
          adminCreateReseller(input: $input) { id }
        }`,
        {
          input: {
            name: 'Dup Slug Attempt',
            slug: createdSlug,
            tier: 'READ_ONLY',
            initialAdminEmail: `e2e-dup-${Date.now().toString(36)}@roviq.test`,
          },
        },
        adminToken,
      );

      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(/already taken/i);
    });
  });

  describe('adminUpdateReseller (ROV-234)', () => {
    it('rejects updating the system reseller', async () => {
      const res = await gql(
        `mutation($id: ID!, $input: AdminUpdateResellerInput!) {
          adminUpdateReseller(id: $id, input: $input) { id name }
        }`,
        {
          id: '00000000-0000-4000-a000-000000000011',
          input: { name: 'Tampered' },
        },
        adminToken,
      );
      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(/cannot be modified/i);
    });

    it('updates name + branding on an active reseller', async () => {
      // Unsuspend first in case earlier tests left it suspended
      await pool.query(
        `UPDATE resellers SET status='ACTIVE', is_active=true, suspended_at=NULL WHERE id=$1`,
        [TEST_RESELLER_ID],
      );

      const res = await gql<{
        adminUpdateReseller: { name: string; branding: { primaryColor: string | null } | null };
      }>(
        `mutation($id: ID!, $input: AdminUpdateResellerInput!) {
          adminUpdateReseller(id: $id, input: $input) {
            id name branding { primaryColor }
          }
        }`,
        {
          id: TEST_RESELLER_ID,
          input: { name: 'Renamed Test Reseller', branding: { primaryColor: '#FF4500' } },
        },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminUpdateReseller.name).toBe('Renamed Test Reseller');
      expect(res.data.adminUpdateReseller.branding?.primaryColor).toBe('#FF4500');
    });
  });

  // ── ROV-234: adminCreateReseller — provisioning failure (log-and-continue) ──

  describe('adminCreateReseller — identity provisioning failure (ROV-234)', () => {
    // Use a per-run suffix so slugs and emails never collide across test runs.
    const suffix = Date.now().toString(36);
    const slug1 = `e2e-pf1-${suffix}`;
    const slug2 = `e2e-pf2-${suffix}`;
    // Both resellers share the same initialAdminEmail — the second call will
    // find a duplicate user and trigger the catch-and-continue path.
    const sharedEmail = `e2e-collision-${suffix}@roviq.test`;
    let resellerId1: string | null = null;
    let resellerId2: string | null = null;

    afterAll(async () => {
      for (const id of [resellerId1, resellerId2]) {
        if (id) {
          await pool.query('DELETE FROM reseller_memberships WHERE reseller_id = $1', [id]);
          await pool.query('DELETE FROM resellers WHERE id = $1', [id]);
        }
      }
      // Also remove the user created by the first mutation (unique email, no FK deps).
      await pool.query('DELETE FROM users WHERE email = $1', [sharedEmail]);
    });

    it('first creation with unique email succeeds normally', async () => {
      const res = await gql<{ adminCreateReseller: { id: string; status: string } }>(
        `mutation($input: AdminCreateResellerInput!) {
          adminCreateReseller(input: $input) { id slug status instituteCount teamSize }
        }`,
        {
          input: {
            name: `E2E PF1 ${suffix}`,
            slug: slug1,
            tier: 'READ_ONLY',
            initialAdminEmail: sharedEmail,
          },
        },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminCreateReseller.status).toBe('ACTIVE');
      resellerId1 = res.data.adminCreateReseller.id;
    });

    it('second creation with same email still commits the reseller (provisioning failure is non-fatal)', async () => {
      // sharedEmail is now taken — IdentityService.createUser() will throw a
      // unique-constraint violation. The service catches it, logs a warning,
      // and commits the reseller row anyway.
      const res = await gql<{
        adminCreateReseller: {
          id: string;
          slug: string;
          status: string;
          instituteCount: number;
          teamSize: number;
        };
      }>(
        `mutation($input: AdminCreateResellerInput!) {
          adminCreateReseller(input: $input) { id slug status instituteCount teamSize }
        }`,
        {
          input: {
            name: `E2E PF2 ${suffix}`,
            slug: slug2,
            tier: 'READ_ONLY',
            initialAdminEmail: sharedEmail,
          },
        },
        adminToken,
      );

      // GraphQL must succeed — provisioning failure is non-fatal
      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminCreateReseller.status).toBe('ACTIVE');
      expect(res.data.adminCreateReseller.slug).toBe(slug2);
      expect(res.data.adminCreateReseller.instituteCount).toBe(0);
      expect(res.data.adminCreateReseller.teamSize).toBe(0);

      resellerId2 = res.data.adminCreateReseller.id;

      // Reseller row must be persisted even without a provisioned admin
      const row = await pool.query<{ id: string; status: string }>(
        'SELECT id, status FROM resellers WHERE id = $1',
        [resellerId2],
      );
      expect(row.rows[0]).toBeDefined();
      expect(row.rows[0].status).toBe('ACTIVE');
    });
  });

  describe('adminChangeResellerTier (ROV-234)', () => {
    it('rejects tier change on the system reseller', async () => {
      const res = await gql(
        `mutation($id: ID!, $tier: ResellerTier!) {
          adminChangeResellerTier(id: $id, newTier: $tier) { id tier }
        }`,
        { id: '00000000-0000-4000-a000-000000000011', tier: 'READ_ONLY' },
        adminToken,
      );
      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(/cannot have its tier changed/i);
    });

    it('changes the tier of an active reseller', async () => {
      await pool.query(
        `UPDATE resellers SET status='ACTIVE', is_active=true, suspended_at=NULL, tier='FULL_MANAGEMENT' WHERE id=$1`,
        [TEST_RESELLER_ID],
      );

      const res = await gql<{ adminChangeResellerTier: { id: string; tier: string } }>(
        `mutation($id: ID!, $tier: ResellerTier!) {
          adminChangeResellerTier(id: $id, newTier: $tier) { id tier }
        }`,
        { id: TEST_RESELLER_ID, tier: 'READ_ONLY' },
        adminToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminChangeResellerTier.tier).toBe('READ_ONLY');

      // Verify DB state
      const after = await pool.query<{ tier: string }>(`SELECT tier FROM resellers WHERE id = $1`, [
        TEST_RESELLER_ID,
      ]);
      expect(after.rows[0].tier).toBe('READ_ONLY');
    });

    it('rejects tier change when reseller is suspended', async () => {
      await gql(
        `mutation($id: String!) { adminSuspendReseller(resellerId: $id, reason: "tier-test") }`,
        { id: TEST_RESELLER_ID },
        adminToken,
      );

      const res = await gql(
        `mutation($id: ID!, $tier: ResellerTier!) {
          adminChangeResellerTier(id: $id, newTier: $tier) { id tier }
        }`,
        { id: TEST_RESELLER_ID, tier: 'FULL_MANAGEMENT' },
        adminToken,
      );

      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(/unsuspend first/i);
    });
  });
});
