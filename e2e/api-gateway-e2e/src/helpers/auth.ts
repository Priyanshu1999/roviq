import { E2E_USERS } from '../../e2e-constants';
import { gql } from './gql-client';

/**
 * Login as admin (multi-institute) → selectInstitute → return tenant-scoped token.
 * Captures tenantId dynamically from the login response (works with both
 * deterministic SEED_IDS in Docker E2E and random IDs in local dev).
 * @param instituteIndex 0 = first institute (Demo), 1 = second institute
 */
export async function loginAsAdmin(
  instituteIndex = 0,
): Promise<{ accessToken: string; refreshToken: string; tenantId: string }> {
  const loginRes = await gql(`
    mutation {
      login(username: "${E2E_USERS.ADMIN.username}", password: "${E2E_USERS.ADMIN.password}") {
        platformToken
        memberships { tenantId instituteName }
      }
    }
  `);

  const platformToken = loginRes.data?.login?.platformToken;
  const tenantId = loginRes.data?.login?.memberships?.[instituteIndex]?.tenantId;

  const selectRes = await gql(
    `mutation SelectInstitute($tenantId: String!) {
      selectInstitute(tenantId: $tenantId) {
        accessToken
        refreshToken
      }
    }`,
    { tenantId },
    platformToken,
  );

  return {
    accessToken: selectRes.data?.selectInstitute.accessToken,
    refreshToken: selectRes.data?.selectInstitute.refreshToken,
    tenantId,
  };
}

/**
 * Login as admin scoped to the second institute (for cross-tenant/RLS tests).
 */
export async function loginAsAdminSecondInstitute(): Promise<{
  accessToken: string;
  tenantId: string;
}> {
  const { accessToken, tenantId } = await loginAsAdmin(1);
  return { accessToken, tenantId };
}

/**
 * Login as teacher (single-institute) → returns direct accessToken.
 */
export async function loginAsTeacher(): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await gql(`
    mutation {
      login(username: "${E2E_USERS.TEACHER.username}", password: "${E2E_USERS.TEACHER.password}") {
        accessToken
        refreshToken
      }
    }
  `);

  return {
    accessToken: res.data?.login.accessToken,
    refreshToken: res.data?.login.refreshToken,
  };
}

/**
 * Login as student (single-institute) → returns direct accessToken.
 */
export async function loginAsStudent(): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
}> {
  const res = await gql(`
    mutation {
      login(username: "${E2E_USERS.STUDENT.username}", password: "${E2E_USERS.STUDENT.password}") {
        accessToken
        refreshToken
        user { id }
      }
    }
  `);

  return {
    accessToken: res.data?.login.accessToken,
    refreshToken: res.data?.login.refreshToken,
    userId: res.data?.login.user.id,
  };
}
