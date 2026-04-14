import { E2E_USERS } from '../../../shared/e2e-users';
import { gql } from './gql-client';

/**
 * Throw a clear error if a login response carried GraphQL errors or empty data,
 * instead of silently returning `accessToken: undefined` and crashing downstream.
 */
function unwrap<T>(
  res: { data?: T | null; errors?: readonly { message: string }[] },
  op: string,
): T {
  if (res.errors?.length) {
    throw new Error(`${op} failed: ${res.errors.map((e) => e.message).join(', ')}`);
  }
  if (!res.data) {
    throw new Error(`${op} returned no data`);
  }
  return res.data;
}

/**
 * Login as a multi-institute admin → selectInstitute → return institute-scoped token.
 *
 * The seeded admin user has both a platform_membership and institute memberships.
 * `instituteLogin` returns `requiresInstituteSelection` + `memberships` (no token);
 * `selectInstitute` then exchanges the selectionToken + chosen membershipId for
 * an institute-scoped access/refresh token pair.
 */
export async function loginAsInstituteAdmin(
  instituteIndex = 0,
): Promise<{ accessToken: string; refreshToken: string; tenantId: string }> {
  const loginData = unwrap(
    await gql(
      `mutation InstituteLogin($username: String!, $password: String!) {
        instituteLogin(username: $username, password: $password) {
          requiresInstituteSelection
          selectionToken
          memberships { membershipId tenantId instituteName }
        }
      }`,
      {
        username: E2E_USERS.INSTITUTE_ADMIN.username,
        password: E2E_USERS.INSTITUTE_ADMIN.password,
      },
    ),
    'instituteLogin (admin)',
  );

  const selectionToken = loginData.instituteLogin.selectionToken;
  const membership = loginData.instituteLogin.memberships?.[instituteIndex];
  if (!selectionToken || !membership) {
    throw new Error(
      `instituteLogin (admin) returned no selectionToken or no membership at index ${instituteIndex}`,
    );
  }

  const selectData = unwrap(
    await gql(
      `mutation SelectInstitute($selectionToken: String!, $membershipId: String!) {
        selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) {
          accessToken
          refreshToken
        }
      }`,
      { selectionToken, membershipId: membership.membershipId },
    ),
    'selectInstitute',
  );

  return {
    accessToken: selectData.selectInstitute.accessToken,
    refreshToken: selectData.selectInstitute.refreshToken,
    tenantId: membership.tenantId,
  };
}

/**
 * Login as institute admin scoped to the second institute (for cross-tenant/RLS tests).
 */
export async function loginAsInstituteAdminSecondInstitute(): Promise<{
  accessToken: string;
  tenantId: string;
}> {
  const { accessToken, tenantId } = await loginAsInstituteAdmin(1);
  return { accessToken, tenantId };
}

/**
 * Login as a platform admin → returns platform-scoped access/refresh token pair.
 */
export async function loginAsPlatformAdmin(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const data = unwrap(
    await gql(
      `mutation AdminLogin($username: String!, $password: String!) {
        adminLogin(username: $username, password: $password) {
          accessToken
          refreshToken
        }
      }`,
      {
        username: E2E_USERS.PLATFORM_ADMIN.username,
        password: E2E_USERS.PLATFORM_ADMIN.password,
      },
    ),
    'adminLogin',
  );
  return {
    accessToken: data.adminLogin.accessToken,
    refreshToken: data.adminLogin.refreshToken,
  };
}

/**
 * Login as reseller → returns reseller-scoped access/refresh token pair.
 */
export async function loginAsReseller(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const data = unwrap(
    await gql(
      `mutation ResellerLogin($username: String!, $password: String!) {
        resellerLogin(username: $username, password: $password) {
          accessToken
          refreshToken
        }
      }`,
      {
        username: E2E_USERS.RESELLER.username,
        password: E2E_USERS.RESELLER.password,
      },
    ),
    'resellerLogin',
  );
  return {
    accessToken: data.resellerLogin.accessToken,
    refreshToken: data.resellerLogin.refreshToken,
  };
}

/**
 * Login as teacher (single-institute) → returns direct accessToken.
 */
export async function loginAsTeacher(): Promise<{ accessToken: string; refreshToken: string }> {
  const data = unwrap(
    await gql(
      `mutation InstituteLogin($username: String!, $password: String!) {
        instituteLogin(username: $username, password: $password) {
          accessToken
          refreshToken
        }
      }`,
      { username: E2E_USERS.TEACHER.username, password: E2E_USERS.TEACHER.password },
    ),
    'instituteLogin (teacher)',
  );
  return {
    accessToken: data.instituteLogin.accessToken,
    refreshToken: data.instituteLogin.refreshToken,
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
  const data = unwrap(
    await gql(
      `mutation InstituteLogin($username: String!, $password: String!) {
        instituteLogin(username: $username, password: $password) {
          accessToken
          refreshToken
          user { id }
        }
      }`,
      { username: E2E_USERS.STUDENT.username, password: E2E_USERS.STUDENT.password },
    ),
    'instituteLogin (student)',
  );
  return {
    accessToken: data.instituteLogin.accessToken,
    refreshToken: data.instituteLogin.refreshToken,
    userId: data.instituteLogin.user.id,
  };
}

/**
 * Login as guardian (single-institute) → returns direct accessToken.
 *
 * Enables consent E2E tests (grantConsent, withdrawConsent, myConsentStatus)
 * and guardian-scoped profile queries (myChildren, sibling discovery). The
 * caller's membership resolves to a guardian profile; without this helper,
 * tests that call consent mutations get ForbiddenException because admin /
 * teacher / student memberships do not carry a guardian profile.
 */
export async function loginAsGuardian(): Promise<{
  accessToken: string;
  refreshToken: string;
  userId: string;
}> {
  const data = unwrap(
    await gql(
      `mutation InstituteLogin($username: String!, $password: String!) {
        instituteLogin(username: $username, password: $password) {
          accessToken
          refreshToken
          user { id }
        }
      }`,
      { username: E2E_USERS.GUARDIAN.username, password: E2E_USERS.GUARDIAN.password },
    ),
    'instituteLogin (guardian)',
  );
  return {
    accessToken: data.instituteLogin.accessToken,
    refreshToken: data.instituteLogin.refreshToken,
    userId: data.instituteLogin.user.id,
  };
}
