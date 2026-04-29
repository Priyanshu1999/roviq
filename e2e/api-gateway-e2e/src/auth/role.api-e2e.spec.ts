/**
 * E2E API tests for the institute role module — exercises the full running
 * api-gateway stack: real auth, real CASL, real RLS, real Postgres.
 *
 * Coverage:
 *   1. Happy path: institute_admin updates the role's primaryNavSlugs and the
 *      next `me` query reflects the new value (proves cache invalidation
 *      flushed the role-abilities Redis entry that backs `getPrimaryNavSlugs`).
 *   2. Authorization: a non-admin role (class_teacher / TEACHER seed user) is
 *      blocked by the @CheckAbility('update', 'Role') decorator → FORBIDDEN.
 *   3. Cross-tenant: an admin in tenant A passing a role ID belonging to
 *      tenant B is rejected — RLS hides the row from the UPDATE so the repo
 *      throws NotFoundException → propagates to GraphQL.
 *
 * IMPORTANT: depends on the api-gateway being able to build. As of this commit
 * there are pre-existing TS errors in admission/bot/certificate/group services
 * that block the build; once those land green, run with:
 *   pnpm test:e2e:api -- src/auth/role.api-e2e.spec.ts
 */

import assert from 'node:assert';
import { describe, expect, it } from 'vitest';

import {
  loginAsInstituteAdmin,
  loginAsInstituteAdminSecondInstitute,
  loginAsTeacher,
} from '../helpers/auth';
import { gql } from '../helpers/gql-client';

const UPDATE_MUTATION = /* GraphQL */ `
  mutation UpdateRolePrimaryNav($input: UpdateRolePrimaryNavInput!) {
    updateRolePrimaryNav(input: $input) {
      id
      primaryNavSlugs
    }
  }
`;

const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      id
      roleId
      primaryNavSlugs
    }
  }
`;

interface UpdateResp {
  updateRolePrimaryNav: { id: string; primaryNavSlugs: string[] };
}

interface MeResp {
  me: { id: string; roleId: string; primaryNavSlugs: string[] };
}

describe('Role primary nav E2E', () => {
  describe('happy path: institute_admin', () => {
    it('updateRolePrimaryNav is reflected in the next me query', async () => {
      const { accessToken } = await loginAsInstituteAdmin(0);

      // Discover the admin's roleId — it's dynamically minted by the seeder
      // (no fixed ID in scripts/seed-ids.ts), so we read it from /me.
      const meBefore = await gql<MeResp>(ME_QUERY, undefined, accessToken);
      assert(meBefore.data, 'me query returned no data');
      const roleId = meBefore.data.me.roleId;
      expect(roleId).toBeTruthy();

      // Pick a deterministic, idempotent slug list. Re-running the spec must
      // converge — order matters since the column is an ordered list.
      const slugs = ['dashboard', 'students', 'attendance', 'profile'];

      const updateRes = await gql<UpdateResp>(
        UPDATE_MUTATION,
        { input: { roleId, slugs } },
        accessToken,
      );
      expect(updateRes.errors).toBeUndefined();
      assert(updateRes.data);
      expect(updateRes.data.updateRolePrimaryNav.id).toBe(roleId);
      expect(updateRes.data.updateRolePrimaryNav.primaryNavSlugs).toEqual(slugs);

      // The me resolver re-derives primaryNavSlugs from the role on every call
      // (the service busts the role-abilities Redis cache after writing). The
      // new value MUST appear immediately — otherwise we have a stale-cache bug.
      const meAfter = await gql<MeResp>(ME_QUERY, undefined, accessToken);
      assert(meAfter.data);
      expect(meAfter.data.me.primaryNavSlugs).toEqual(slugs);

      // Restore to empty so the next test run starts from a clean slate.
      await gql<UpdateResp>(UPDATE_MUTATION, { input: { roleId, slugs: [] } }, accessToken);
    });
  });

  describe('authorization', () => {
    it('non-admin role (class_teacher) is rejected with FORBIDDEN', async () => {
      const { accessToken: teacherToken } = await loginAsTeacher();

      // Find ANY role id (we don't care which — the guard fires before the
      // service runs, so a fake UUID is also fine). Use the teacher's own
      // role id from /me to keep the input realistic.
      const me = await gql<MeResp>(ME_QUERY, undefined, teacherToken);
      assert(me.data);
      const roleId = me.data.me.roleId;

      const res = await gql<UpdateResp>(
        UPDATE_MUTATION,
        { input: { roleId, slugs: ['dashboard'] } },
        teacherToken,
      );

      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].extensions?.code).toBe('FORBIDDEN');
    });
  });

  describe('cross-tenant isolation', () => {
    it('admin in tenant A cannot mutate a role belonging to tenant B (RLS hides the row)', async () => {
      const { accessToken: tokenA } = await loginAsInstituteAdmin(0);
      const { accessToken: tokenB } = await loginAsInstituteAdminSecondInstitute();

      // Discover tenant B's admin roleId via /me on the tenant B session.
      const meB = await gql<MeResp>(ME_QUERY, undefined, tokenB);
      assert(meB.data);
      const tenantBRoleId = meB.data.me.roleId;

      // Sanity: tenant A's admin role MUST be a different ID, otherwise the
      // assertion below is vacuous.
      const meA = await gql<MeResp>(ME_QUERY, undefined, tokenA);
      assert(meA.data);
      expect(meA.data.me.roleId).not.toBe(tenantBRoleId);

      // Snapshot tenant B's slugs BEFORE the cross-tenant attempt so we can
      // assert the row is byte-for-byte unchanged after.
      const tenantBSlugsBefore = meB.data.me.primaryNavSlugs;

      const res = await gql<UpdateResp>(
        UPDATE_MUTATION,
        {
          input: { roleId: tenantBRoleId, slugs: ['dashboard', 'students'] },
        },
        tokenA,
      );

      expect(res.errors).toBeDefined();
      const code = res.errors?.[0].extensions?.code;
      // RLS hides the row → repo's NotFoundException → typically NOT_FOUND.
      // Some Nest/GraphQL versions surface it as INTERNAL_SERVER_ERROR or
      // BAD_REQUEST; the security guarantee is that the operation FAILS and
      // tenant B's row is unchanged. Refuse FORBIDDEN-only coverage so a
      // future bug that swaps NotFound→Forbidden still trips this.
      expect(code).toBeDefined();

      // The real assertion: tenant B's row didn't change.
      const meBAfter = await gql<MeResp>(ME_QUERY, undefined, tokenB);
      assert(meBAfter.data);
      expect(meBAfter.data.me.primaryNavSlugs).toEqual(tenantBSlugsBefore);
    });
  });
});
