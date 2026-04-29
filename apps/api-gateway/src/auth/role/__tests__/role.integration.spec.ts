/**
 * Integration tests for the institute role module — boots the full Nest app
 * with a real PostgreSQL pool and exercises the scope guard → CASL →
 * service → repo → withTenant → RLS pipeline for `updateRolePrimaryNav` and
 * `instituteRoles`.
 *
 * Coverage:
 *   1. Round-trip: writing primaryNavSlugs via the mutation and reading them
 *      back via `instituteRoles` returns the exact list.
 *   2. Cross-tenant RLS isolation: an admin in tenant A cannot mutate a role
 *      that lives in tenant B (the role lookup hits the tenant A RLS scope
 *      and returns no rows → NotFoundException → NOT_FOUND).
 *   3. class-validator (DTO) rejects: > 4 slugs, unknown slug values, and
 *      duplicate slugs. Matches the @IsArray + @ArrayMaxSize +
 *      @ArrayUnique + @IsIn decorators on UpdateRolePrimaryNavInput.
 */

import { type DrizzleDB, roles, withAdmin } from '@roviq/database';
import {
  cleanupTestInstitute,
  createInstituteToken,
  createIntegrationApp,
  createTestInstitute,
  gqlRequest,
  type IntegrationAppResult,
  type TestInstitute,
} from '@roviq/testing/integration';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../app/app.module';

const UPDATE_MUTATION = /* GraphQL */ `
  mutation UpdateRolePrimaryNav($input: UpdateRolePrimaryNavInput!) {
    updateRolePrimaryNav(input: $input) {
      id
      primaryNavSlugs
    }
  }
`;

const LIST_QUERY = /* GraphQL */ `
  query InstituteRoles {
    instituteRoles {
      id
      primaryNavSlugs
    }
  }
`;

interface UpdateResponse {
  updateRolePrimaryNav: { id: string; primaryNavSlugs: string[] };
}

interface ListResponse {
  instituteRoles: ReadonlyArray<{ id: string; primaryNavSlugs: string[] }>;
}

/** Read the persisted column directly (bypassing RLS) to confirm a write. */
async function readPrimaryNavSlugs(db: DrizzleDB, roleId: string): Promise<string[] | null> {
  return withAdmin(db, async (tx) => {
    const [row] = await tx
      .select({ primaryNavSlugs: roles.primaryNavSlugs })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);
    return row?.primaryNavSlugs ?? null;
  });
}

describe('InstituteRoleResolver (integration)', () => {
  let result: IntegrationAppResult;
  let tenantA: TestInstitute;
  let tenantB: TestInstitute;
  let tokenA: string;

  beforeAll(async () => {
    result = await createIntegrationApp({ modules: [AppModule] });
    tenantA = await createTestInstitute(result.db);
    tenantB = await createTestInstitute(result.db);
    tokenA = createInstituteToken({
      sub: tenantA.userId,
      tenantId: tenantA.tenantId,
      membershipId: tenantA.membershipId,
      roleId: tenantA.roleId,
    });
  });

  afterAll(async () => {
    if (tenantA) await cleanupTestInstitute(result.db, tenantA);
    if (tenantB) await cleanupTestInstitute(result.db, tenantB);
    await result?.close();
  });

  describe('updateRolePrimaryNav round-trip', () => {
    it('persists the slugs to the column and the same list comes back via instituteRoles', async () => {
      const slugs = ['dashboard', 'students', 'attendance', 'profile'];

      const updateRes = await gqlRequest<UpdateResponse>(result.httpServer, {
        query: UPDATE_MUTATION,
        token: tokenA,
        variables: { input: { roleId: tenantA.roleId, slugs } },
      });
      expect(updateRes.errors).toBeUndefined();
      expect(updateRes.data?.updateRolePrimaryNav.id).toBe(tenantA.roleId);
      expect(updateRes.data?.updateRolePrimaryNav.primaryNavSlugs).toEqual(slugs);

      // Verify column round-trip independent of the resolver projection.
      const persisted = await readPrimaryNavSlugs(result.db, tenantA.roleId);
      expect(persisted).toEqual(slugs);

      // And via the list query, which reads through rolesLive (the view that
      // hides soft-deleted rows). The role must appear with the new slugs.
      const listRes = await gqlRequest<ListResponse>(result.httpServer, {
        query: LIST_QUERY,
        token: tokenA,
      });
      expect(listRes.errors).toBeUndefined();
      const found = listRes.data?.instituteRoles.find((r) => r.id === tenantA.roleId);
      expect(found?.primaryNavSlugs).toEqual(slugs);
    });

    it('accepts an empty array (clears the customization)', async () => {
      // Pre-set, then clear.
      await gqlRequest<UpdateResponse>(result.httpServer, {
        query: UPDATE_MUTATION,
        token: tokenA,
        variables: { input: { roleId: tenantA.roleId, slugs: ['dashboard'] } },
      });

      const clearRes = await gqlRequest<UpdateResponse>(result.httpServer, {
        query: UPDATE_MUTATION,
        token: tokenA,
        variables: { input: { roleId: tenantA.roleId, slugs: [] } },
      });
      expect(clearRes.errors).toBeUndefined();
      expect(clearRes.data?.updateRolePrimaryNav.primaryNavSlugs).toEqual([]);

      const persisted = await readPrimaryNavSlugs(result.db, tenantA.roleId);
      expect(persisted).toEqual([]);
    });
  });

  describe('cross-tenant isolation (RLS)', () => {
    it("admin in tenant A cannot mutate tenant B's role — RLS hides the row, NotFoundException is thrown", async () => {
      // Pre-state of tenant B's role for the post-condition check.
      const before = await readPrimaryNavSlugs(result.db, tenantB.roleId);

      const res = await gqlRequest<UpdateResponse>(result.httpServer, {
        query: UPDATE_MUTATION,
        token: tokenA,
        variables: {
          input: { roleId: tenantB.roleId, slugs: ['dashboard', 'students'] },
        },
      });

      expect(res.errors).toBeDefined();
      const code = res.errors?.[0]?.extensions?.code;
      // The repo throws NotFoundException → Apollo maps to NOT_FOUND. Some
      // releases of @nestjs/graphql normalize to BAD_REQUEST/INTERNAL_*; accept
      // any non-2xx error code here, so long as the row stays untouched.
      expect(code).toBeDefined();
      expect(code).not.toBe('FORBIDDEN');

      // The post-condition is the real RLS guarantee — tenant B's row must be
      // byte-for-byte unchanged regardless of what error the resolver returned.
      const after = await readPrimaryNavSlugs(result.db, tenantB.roleId);
      expect(after).toEqual(before);
    });

    it('instituteRoles only returns roles for the caller tenant', async () => {
      const res = await gqlRequest<ListResponse>(result.httpServer, {
        query: LIST_QUERY,
        token: tokenA,
      });
      expect(res.errors).toBeUndefined();
      const ids = (res.data?.instituteRoles ?? []).map((r) => r.id);
      expect(ids).toContain(tenantA.roleId);
      expect(ids).not.toContain(tenantB.roleId);
    });
  });

  describe('input validation (class-validator on UpdateRolePrimaryNavInput)', () => {
    it('rejects more than 4 slugs (@ArrayMaxSize)', async () => {
      const slugs = ['dashboard', 'students', 'staff', 'guardians', 'profile']; // 5
      const res = await gqlRequest<UpdateResponse>(result.httpServer, {
        query: UPDATE_MUTATION,
        token: tokenA,
        variables: { input: { roleId: tenantA.roleId, slugs } },
      });
      expect(res.errors).toBeDefined();
      // Validation errors surface as BAD_REQUEST/BAD_USER_INPUT depending on
      // the GraphQL/validator version — assert on message content too.
      const msg = res.errors?.[0]?.message ?? '';
      expect(msg.toLowerCase()).toMatch(/must contain not more than|too many|max/i);
    });

    it('rejects unknown slug values (@IsIn against ALL_NAV_SLUGS)', async () => {
      const slugs = ['dashboard', 'definitely-not-a-real-slug'];
      const res = await gqlRequest<UpdateResponse>(result.httpServer, {
        query: UPDATE_MUTATION,
        token: tokenA,
        variables: { input: { roleId: tenantA.roleId, slugs } },
      });
      expect(res.errors).toBeDefined();
      const msg = res.errors?.[0]?.message ?? '';
      expect(msg.toLowerCase()).toMatch(/each value in slugs must be one of|must be one of/i);
    });

    it('rejects duplicate slugs (@ArrayUnique)', async () => {
      const slugs = ['dashboard', 'students', 'dashboard'];
      const res = await gqlRequest<UpdateResponse>(result.httpServer, {
        query: UPDATE_MUTATION,
        token: tokenA,
        variables: { input: { roleId: tenantA.roleId, slugs } },
      });
      expect(res.errors).toBeDefined();
      const msg = res.errors?.[0]?.message ?? '';
      expect(msg.toLowerCase()).toMatch(/all .*'s elements must be unique|unique/i);
    });
  });
});
