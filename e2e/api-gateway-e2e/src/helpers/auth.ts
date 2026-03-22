import { E2E_USERS } from '../../e2e-constants';
import { gql } from './gql-client';

/**
 * Login as admin (multi-institute) → selectInstitute → return institute-scoped token.
 *
 * The admin user has both a platform_membership and institute memberships.
 * instituteLogin returns requiresInstituteSelection + memberships (no token).
 * selectInstitute requires GqlAuthGuard, so we use adminLogin to get a
 * selectInstitute is unauthenticated — takes selectionToken + membershipId from the login response.
 */
export async function loginAsAdmin(
  instituteIndex = 0,
): Promise<{ accessToken: string; refreshToken: string; tenantId: string }> {
  const loginRes = await gql(`
    mutation {
      instituteLogin(username: "${E2E_USERS.ADMIN.username}", password: "${E2E_USERS.ADMIN.password}") {
        requiresInstituteSelection
        selectionToken
        memberships { membershipId tenantId instituteName }
      }
    }
  `);

  const selectionToken = loginRes.data?.instituteLogin?.selectionToken;
  const membershipId = loginRes.data?.instituteLogin?.memberships?.[instituteIndex]?.membershipId;
  const tenantId = loginRes.data?.instituteLogin?.memberships?.[instituteIndex]?.tenantId;

  const selectRes = await gql(
    `mutation SelectInstitute($selectionToken: String!, $membershipId: String!) {
      selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) {
        accessToken
        refreshToken
      }
    }`,
    { selectionToken, membershipId },
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
      instituteLogin(username: "${E2E_USERS.TEACHER.username}", password: "${E2E_USERS.TEACHER.password}") {
        accessToken
        refreshToken
      }
    }
  `);
  return {
    accessToken: res.data?.instituteLogin.accessToken,
    refreshToken: res.data?.instituteLogin.refreshToken,
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
      instituteLogin(username: "${E2E_USERS.STUDENT.username}", password: "${E2E_USERS.STUDENT.password}") {
        accessToken
        refreshToken
        user { id }
      }
    }
  `);
  return {
    accessToken: res.data?.instituteLogin.accessToken,
    refreshToken: res.data?.instituteLogin.refreshToken,
    userId: res.data?.instituteLogin.user.id,
  };
}
