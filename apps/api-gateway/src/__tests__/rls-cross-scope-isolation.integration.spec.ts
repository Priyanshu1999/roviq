/**
 * RLS cross-scope isolation — integration tests.
 *
 * Three-tier defense model:
 *   1. TypeScript types  — branded context unions make wrong-scope calls a
 *      compile error (withTenant requires InstituteContext, etc.).
 *   2. Schema gates      — CI guards (check:live-views, check:rls-coverage)
 *      enforce every table has policies.
 *   3. Runtime isolation — THIS FILE. Even if types are bypassed at runtime
 *      (e.g. via JSON deserialization), the DB rejects cross-tenant reads and
 *      cross-reseller reads at the Postgres layer.
 *
 * Tests hit the DB directly via Drizzle wrappers — no NestJS app is booted.
 * That is intentional: these tests prove Postgres-layer enforcement, not app
 * layer enforcement (scope guards + CASL cover the app layer in the sibling
 * spec files).
 */

import { randomUUID } from 'node:crypto';
import { AcademicStatus, AdmissionType, SocialCategory } from '@roviq/common-types';
import {
  createDrizzleDb,
  type DrizzleDB,
  institutes,
  institutesLive,
  memberships,
  mkAdminCtx,
  mkInstituteCtx,
  mkResellerCtx,
  resellers,
  roles,
  SYSTEM_USER_ID,
  studentProfiles,
  studentProfilesLive,
  users,
  withAdmin,
  withReseller,
  withTenant,
} from '@roviq/database';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Skip the entire suite when the test DB is not available (unit test runs).
const hasTestDb = !!process.env.DATABASE_URL_TEST;

const DB_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://roviq_pooler:roviq_pooler_dev@localhost:5434/roviq_test';

// ── Fixture types ─────────────────────────────────────────────────────────────

interface TenantFixture {
  tenantId: string;
  studentProfileId: string;
  userId: string;
  membershipId: string;
  roleId: string;
}

// ── Fixture helpers ───────────────────────────────────────────────────────────

/** Create a minimal tenant + student profile under withAdmin so tests are isolated. */
async function createTenantWithStudent(db: DrizzleDB, resellerId: string): Promise<TenantFixture> {
  const suffix = randomUUID().slice(0, 8);

  return withAdmin(db, mkAdminCtx('test:rls-cross-scope'), async (tx) => {
    const [inst] = await tx
      .insert(institutes)
      .values({
        name: { en: `RLS Test Institute ${suffix}` },
        slug: `rls-test-${suffix}`,
        resellerId,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: institutes.id });

    const [user] = await tx
      .insert(users)
      .values({
        email: `rls_stu_${suffix}@test.local`,
        username: `rls_stu_${suffix}`,
        passwordHash: 'not-a-real-hash',
      })
      .returning({ id: users.id });

    const [role] = await tx
      .insert(roles)
      .values({
        name: { en: `RLS Test Role ${suffix}` },
        scope: 'institute',
        tenantId: inst.id,
        abilities: [],
        isDefault: false,
        isSystem: false,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: roles.id });

    const [membership] = await tx
      .insert(memberships)
      .values({
        userId: user.id,
        roleId: role.id,
        tenantId: inst.id,
        abilities: [],
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: memberships.id });

    const [profile] = await tx
      .insert(studentProfiles)
      .values({
        tenantId: inst.id,
        userId: user.id,
        membershipId: membership.id,
        admissionNumber: `RLS-ADM-${suffix}`,
        admissionDate: '2025-04-01',
        admissionType: AdmissionType.NEW,
        academicStatus: AcademicStatus.ENROLLED,
        socialCategory: SocialCategory.GENERAL,
        createdBy: SYSTEM_USER_ID,
        updatedBy: SYSTEM_USER_ID,
      })
      .returning({ id: studentProfiles.id });

    return {
      tenantId: inst.id,
      studentProfileId: profile.id,
      userId: user.id,
      membershipId: membership.id,
      roleId: role.id,
    };
  });
}

/** Create a minimal reseller (no members needed for isolation tests). */
async function createIsolatedReseller(db: DrizzleDB): Promise<string> {
  const suffix = randomUUID().slice(0, 8);
  return withAdmin(db, mkAdminCtx('test:rls-cross-scope'), async (tx) => {
    const [r] = await tx
      .insert(resellers)
      .values({ name: `RLS Reseller ${suffix}`, slug: `rls-reseller-${suffix}` })
      .returning({ id: resellers.id });
    return r.id;
  });
}

/** Delete a tenant fixture in reverse FK order. */
async function cleanupTenantFixture(db: DrizzleDB, f: TenantFixture): Promise<void> {
  await withAdmin(db, mkAdminCtx('test:rls-cross-scope'), async (tx) => {
    await tx.delete(studentProfiles).where(eq(studentProfiles.id, f.studentProfileId));
    await tx.delete(memberships).where(eq(memberships.id, f.membershipId));
    await tx.delete(roles).where(eq(roles.id, f.roleId));
    await tx.delete(institutes).where(eq(institutes.id, f.tenantId));
    await tx.delete(users).where(eq(users.id, f.userId));
  });
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe.skipIf(!hasTestDb)('RLS cross-scope isolation', () => {
  let pool: Pool;
  let db: DrizzleDB;

  // Tenants A and B share RESELLER_DIRECT (cross-tenant isolation tests).
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  // Two fresh resellers with one institute each (cross-reseller isolation tests).
  let resellerR1: string;
  let resellerR2: string;
  let r1Inst: TenantFixture;
  let r2Inst: TenantFixture;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB_URL, max: 5, idleTimeoutMillis: 10_000 });
    db = createDrizzleDb(pool);

    // Fetch the canonical "Roviq Direct" reseller by slug rather than hard-coding
    // the UUID — the seed UUID format may differ between DB versions.
    const [directReseller] = await withAdmin(db, mkAdminCtx('test:rls-cross-scope'), (tx) =>
      tx.select({ id: resellers.id }).from(resellers).where(eq(resellers.slug, 'roviq-direct')),
    );
    if (!directReseller) {
      throw new Error('Seed reseller "roviq-direct" not found. Run: pnpm db:reset --test');
    }
    const resellerDirectId = directReseller.id;

    tenantA = await createTenantWithStudent(db, resellerDirectId);
    tenantB = await createTenantWithStudent(db, resellerDirectId);
    resellerR1 = await createIsolatedReseller(db);
    resellerR2 = await createIsolatedReseller(db);
    r1Inst = await createTenantWithStudent(db, resellerR1);
    r2Inst = await createTenantWithStudent(db, resellerR2);
  });

  afterAll(async () => {
    await cleanupTenantFixture(db, r1Inst);
    await cleanupTenantFixture(db, r2Inst);
    await cleanupTenantFixture(db, tenantA);
    await cleanupTenantFixture(db, tenantB);
    await withAdmin(db, mkAdminCtx('test:rls-cross-scope'), async (tx) => {
      await tx.delete(resellers).where(eq(resellers.id, resellerR1));
      await tx.delete(resellers).where(eq(resellers.id, resellerR2));
    });
    await pool.end();
  });

  // ── Scenario 1 ───────────────────────────────────────────────────────────────
  it('withTenant(A) sees only tenant A student profiles', async () => {
    // Regression class: a broken SET LOCAL omission or wrong config key would
    // let tenant A see all rows from the table, leaking tenant B data.
    const rows = await withTenant(
      db,
      mkInstituteCtx(tenantA.tenantId, 'test:rls-cross-scope'),
      (tx) => tx.select({ id: studentProfilesLive.id }).from(studentProfilesLive),
    );

    const ids = rows.map((r) => r.id);
    expect(ids).toContain(tenantA.studentProfileId);
    expect(ids).not.toContain(tenantB.studentProfileId);
  });

  // ── Scenario 2 ───────────────────────────────────────────────────────────────
  it('withTenant(A) + explicit WHERE tenantId=B returns 0 rows', async () => {
    // Regression class: a service-layer bug injecting a cross-tenant tenantId
    // into a WHERE clause. RLS silently filters the row out even when the WHERE
    // would otherwise match it.
    const rows = await withTenant(
      db,
      mkInstituteCtx(tenantA.tenantId, 'test:rls-cross-scope'),
      (tx) =>
        tx
          .select({ id: studentProfilesLive.id })
          .from(studentProfilesLive)
          .where(eq(studentProfilesLive.tenantId, tenantB.tenantId)),
    );

    expect(rows).toHaveLength(0);
  });

  // ── Scenario 3 ───────────────────────────────────────────────────────────────
  it('withTenant(B) sees only tenant B student profiles', async () => {
    // Symmetry check — verifies isolation is enforced in both directions.
    const rows = await withTenant(
      db,
      mkInstituteCtx(tenantB.tenantId, 'test:rls-cross-scope'),
      (tx) => tx.select({ id: studentProfilesLive.id }).from(studentProfilesLive),
    );

    const ids = rows.map((r) => r.id);
    expect(ids).toContain(tenantB.studentProfileId);
    expect(ids).not.toContain(tenantA.studentProfileId);
  });

  // ── Scenario 4 ───────────────────────────────────────────────────────────────
  it('withAdmin sees student profiles from any tenant', async () => {
    // Regression class: if roviq_admin were accidentally scoped, platform
    // operations (compliance exports, billing reconciliation) would silently
    // miss rows from other tenants.
    const rowsA = await withAdmin(db, mkAdminCtx('test:rls-cross-scope'), (tx) =>
      tx
        .select({ id: studentProfilesLive.id })
        .from(studentProfilesLive)
        .where(eq(studentProfilesLive.tenantId, tenantA.tenantId)),
    );
    expect(rowsA.map((r) => r.id)).toContain(tenantA.studentProfileId);

    const rowsB = await withAdmin(db, mkAdminCtx('test:rls-cross-scope'), (tx) =>
      tx
        .select({ id: studentProfilesLive.id })
        .from(studentProfilesLive)
        .where(eq(studentProfilesLive.tenantId, tenantB.tenantId)),
    );
    expect(rowsB.map((r) => r.id)).toContain(tenantB.studentProfileId);
  });

  // ── Scenario 5 ───────────────────────────────────────────────────────────────
  it('withReseller(R1) sees only R1 institutes, not R2 institutes', async () => {
    // Regression class: a missing reseller_id filter in the RLS policy would
    // let reseller R1 enumerate all institutes including competitors' data.
    const rows = await withReseller(db, mkResellerCtx(resellerR1, 'test:rls-cross-scope'), (tx) =>
      tx.select({ id: institutesLive.id }).from(institutesLive),
    );

    const ids = rows.map((r) => r.id);
    expect(ids).toContain(r1Inst.tenantId);
    expect(ids).not.toContain(r2Inst.tenantId);
  });

  // ── Scenario 6 ───────────────────────────────────────────────────────────────
  it('withReseller(R2) sees only R2 institutes, not R1 institutes', async () => {
    // Symmetry check — verifies both resellers are equally isolated.
    const rows = await withReseller(db, mkResellerCtx(resellerR2, 'test:rls-cross-scope'), (tx) =>
      tx.select({ id: institutesLive.id }).from(institutesLive),
    );

    const ids = rows.map((r) => r.id);
    expect(ids).toContain(r2Inst.tenantId);
    expect(ids).not.toContain(r1Inst.tenantId);
  });

  // ── Scenario 7 ───────────────────────────────────────────────────────────────
  it('withTenant(A) INSERT with tenantId=B is blocked by RLS WITH CHECK', async () => {
    // Regression class: a service-layer bug passing the wrong tenantId to an
    // insert. The WITH CHECK policy on roviq_app must reject it with an error.
    const suffix = randomUUID().slice(0, 8);

    const [tempUser] = await withAdmin(db, mkAdminCtx('test:rls-cross-scope'), (tx) =>
      tx
        .insert(users)
        .values({
          email: `rls_cross_${suffix}@test.local`,
          username: `rls_cross_${suffix}`,
          passwordHash: 'not-a-real-hash',
        })
        .returning({ id: users.id }),
    );

    const [tempMembership] = await withAdmin(db, mkAdminCtx('test:rls-cross-scope'), (tx) =>
      tx
        .insert(memberships)
        .values({
          userId: tempUser.id,
          roleId: tenantA.roleId,
          tenantId: tenantA.tenantId,
          abilities: [],
          createdBy: SYSTEM_USER_ID,
          updatedBy: SYSTEM_USER_ID,
        })
        .returning({ id: memberships.id }),
    );

    try {
      await expect(
        withTenant(db, mkInstituteCtx(tenantA.tenantId, 'test:rls-cross-scope'), (tx) =>
          tx
            .insert(studentProfiles)
            .values({
              tenantId: tenantB.tenantId, // cross-tenant write attempt
              userId: tempUser.id,
              membershipId: tempMembership.id,
              admissionNumber: `CROSS-${suffix}`,
              admissionDate: '2025-04-01',
              admissionType: AdmissionType.NEW,
              academicStatus: AcademicStatus.ENROLLED,
              socialCategory: SocialCategory.GENERAL,
              createdBy: SYSTEM_USER_ID,
              updatedBy: SYSTEM_USER_ID,
            })
            .returning({ id: studentProfiles.id }),
        ),
      ).rejects.toThrow();
    } finally {
      await withAdmin(db, mkAdminCtx('test:rls-cross-scope'), async (tx) => {
        await tx.delete(memberships).where(eq(memberships.id, tempMembership.id));
        await tx.delete(users).where(eq(users.id, tempUser.id));
      });
    }
  });

  // ── Scenario 8 ───────────────────────────────────────────────────────────────
  it('withTenant(B) UPDATE on tenant A row affects 0 rows', async () => {
    // Regression class: a privilege escalation bug letting a tenant B session
    // modify another tenant's data. The UPDATE USING clause filters the row
    // out silently — 0 rows updated, no error.
    const result = await withTenant(
      db,
      mkInstituteCtx(tenantB.tenantId, 'test:rls-cross-scope'),
      (tx) =>
        tx
          .update(studentProfiles)
          .set({ admissionNumber: 'HACKED' })
          .where(eq(studentProfiles.id, tenantA.studentProfileId))
          .returning({ id: studentProfiles.id }),
    );

    expect(result).toHaveLength(0);

    // Verify the original row is untouched.
    const [original] = await withAdmin(db, mkAdminCtx('test:rls-cross-scope'), (tx) =>
      tx
        .select({ admissionNumber: studentProfiles.admissionNumber })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, tenantA.studentProfileId)),
    );
    expect(original.admissionNumber).not.toBe('HACKED');
  });

  // ── Scenario 9: GUC override re-evaluates RLS on every query ──
  // RLS policies bind to `current_setting('app.current_tenant_id')` at
  // query time, so a mid-transaction GUC override flips visibility — the
  // session can read what the NEW value allows, not what was active at
  // entry. We pin both halves: tenantA's row becomes invisible after the
  // override, AND tenantB's row becomes visible (proving the swap really
  // happened, not "everything broke").
  it('app.current_tenant_id GUC override re-applies RLS on every read', async () => {
    const { aRow, bRow } = await withTenant(
      db,
      mkInstituteCtx(tenantA.tenantId, 'test:rls-cross-scope'),
      async (tx) => {
        await tx.execute(
          sql`SELECT set_config('app.current_tenant_id', ${tenantB.tenantId}, true)`,
        );
        const aRes = await tx
          .select({ id: studentProfilesLive.id })
          .from(studentProfilesLive)
          .where(eq(studentProfilesLive.id, tenantA.studentProfileId));
        const bRes = await tx
          .select({ id: studentProfilesLive.id })
          .from(studentProfilesLive)
          .where(eq(studentProfilesLive.id, tenantB.studentProfileId));
        return { aRow: aRes, bRow: bRes };
      },
    );
    expect(aRow).toHaveLength(0);
    expect(bRow).toHaveLength(1);
    expect(bRow[0].id).toBe(tenantB.studentProfileId);
  });

  // RESET ROLE drops the session back to the LOGIN role (`roviq_pooler`),
  // which is NOINHERIT and has no direct grants — every privileged
  // operation lives behind `SET LOCAL ROLE roviq_app|reseller|admin`.
  // Verified: SELECT on student_profiles after RESET ROLE → permission
  // denied (not an empty result), so the assertion is strict. Drizzle
  // wraps the PG error into a "Failed query: ..." message at the top
  // level — the original `permission denied` is on the `.cause` chain,
  // so we walk the chain rather than match the top message.
  it('RESET ROLE inside withTenant fails with permission denied', async () => {
    let caught: unknown;
    try {
      await withTenant(db, mkInstituteCtx(tenantA.tenantId, 'test:rls-cross-scope'), async (tx) => {
        await tx.execute(sql`RESET ROLE`);
        return tx.select({ id: studentProfiles.id }).from(studentProfiles);
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    // Walk Error.cause chain to find the underlying PG permission error.
    let messages = '';
    let cur: unknown = caught;
    while (cur instanceof Error) {
      messages += `${cur.message}\n`;
      cur = (cur as Error & { cause?: unknown }).cause;
    }
    expect(messages).toMatch(/permission denied/i);
  });

  // The two SET LOCAL ROLE escalation cases I originally added were wrong:
  // PG's `SET ROLE` permission check is against session_authorization (the
  // connection's authenticated role), not the current effective role. The
  // pooler connection is a member of all three privileged roles (that's
  // how withAdmin/withReseller/withTenant switch into them), so a raw
  // SET LOCAL ROLE between them succeeds at the DB layer. The boundary is
  // application-side: only the trusted DB-wrapper functions perform the
  // switch and match it with the corresponding `app.current_*_id` GUC.
  // That invariant is enforced at compile time by branded-context.spec.ts.
});
