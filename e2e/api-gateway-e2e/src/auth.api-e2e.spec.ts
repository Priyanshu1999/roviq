import assert from 'node:assert';
import type { AuthPayload, InstituteLoginResult, UserType } from '@roviq/graphql/generated';
import { beforeAll, describe, expect, it } from 'vitest';
import { E2E_USERS } from '../../shared/e2e-users';
import { gql } from './helpers/gql-client';

describe('Auth E2E', () => {
  let adminAccessToken: string;
  let adminRefreshToken: string;

  beforeAll(async () => {
    // Verify API is reachable
    const res = await gql('{ __typename }');
    expect(res.data?.__typename).toBe('Query');
  });

  describe('instituteLogin', () => {
    it('should return requiresInstituteSelection + memberships for multi-institute user (admin)', async () => {
      const res = await gql<{ instituteLogin: InstituteLoginResult }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            accessToken
            refreshToken
            requiresInstituteSelection
            memberships { membershipId tenantId instituteName instituteSlug roleName }
          }
        }`,
        {
          username: E2E_USERS.INSTITUTE_ADMIN.username,
          password: E2E_USERS.INSTITUTE_ADMIN.password,
        },
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      // Multi-institute user gets requiresInstituteSelection, not direct accessToken
      expect(res.data.instituteLogin.requiresInstituteSelection).toBe(true);
      expect(res.data.instituteLogin.accessToken).toBeNull();
      expect(res.data.instituteLogin.memberships).toHaveLength(2);
      expect(res.data.instituteLogin.memberships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            instituteName: expect.objectContaining({ en: 'Saraswati Vidya Mandir' }),
            roleName: expect.objectContaining({ en: 'institute_admin' }),
          }),
          expect.objectContaining({
            instituteName: expect.objectContaining({ en: 'Rajasthan Public School' }),
            roleName: expect.objectContaining({ en: 'institute_admin' }),
          }),
        ]),
      );
    });

    it('should return accessToken directly for single-institute user (teacher1)', async () => {
      const res = await gql<{ instituteLogin: InstituteLoginResult }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            accessToken
            refreshToken
            requiresInstituteSelection
            user { id username email tenantId roleId abilityRules }
          }
        }`,
        { username: E2E_USERS.TEACHER.username, password: E2E_USERS.TEACHER.password },
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      // Single-institute user gets accessToken directly
      expect(res.data.instituteLogin.accessToken).toBeTruthy();
      expect(res.data.instituteLogin.refreshToken).toBeTruthy();
      expect(res.data.instituteLogin.requiresInstituteSelection).toBeFalsy();
      expect(res.data.instituteLogin.user?.username).toBe(E2E_USERS.TEACHER.username);
    });

    it('should return manage-all ability rules for institute_admin via selectInstitute', async () => {
      // instituteLogin as admin (multi-institute) → get selectionToken + memberships
      const loginRes = await gql<{ instituteLogin: InstituteLoginResult }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            requiresInstituteSelection
            selectionToken
            memberships { membershipId tenantId }
          }
        }`,
        {
          username: E2E_USERS.INSTITUTE_ADMIN.username,
          password: E2E_USERS.INSTITUTE_ADMIN.password,
        },
      );
      assert(loginRes.data);
      const selectionToken = loginRes.data.instituteLogin.selectionToken;
      const membershipId = loginRes.data.instituteLogin.memberships?.[0].membershipId;
      const tenantId = loginRes.data.instituteLogin.memberships?.[0].tenantId;

      // Select institute — unauthenticated, uses selectionToken + membershipId
      const res = await gql<{ selectInstitute: AuthPayload }>(
        `mutation SelectInstitute($selectionToken: String!, $membershipId: String!) {
          selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) {
            accessToken
            refreshToken
            user { id username tenantId roleId abilityRules }
          }
        }`,
        { selectionToken, membershipId },
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      const { user, accessToken, refreshToken } = res.data.selectInstitute;
      assert(user);
      assert(accessToken);
      assert(refreshToken);
      expect(user.username).toBe(E2E_USERS.INSTITUTE_ADMIN.username);
      expect(user.tenantId).toBe(tenantId);

      const rules = user.abilityRules;
      expect(rules).toEqual(
        expect.arrayContaining([expect.objectContaining({ action: 'manage', subject: 'all' })]),
      );

      // Store for later tests
      adminAccessToken = accessToken;
      adminRefreshToken = refreshToken;
    });

    it('should return limited ability rules for teacher', async () => {
      const res = await gql<{ instituteLogin: { user: UserType } }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            user { abilityRules }
          }
        }`,
        { username: E2E_USERS.TEACHER.username, password: E2E_USERS.TEACHER.password },
      );

      assert(res.data);
      const { user } = res.data.instituteLogin;
      assert(user);
      const rules = user.abilityRules ?? [];
      expect(rules.length).toBeGreaterThan(1);

      // Teacher should have read:Student but NOT manage:all
      const hasReadStudent = rules.some((r) => r.action === 'read' && r.subject === 'Student');
      const hasManageAll = rules.some((r) => r.action === 'manage' && r.subject === 'all');
      expect(hasReadStudent).toBe(true);
      expect(hasManageAll).toBe(false);
    });

    it('should return student abilities with condition placeholder resolved', async () => {
      const res = await gql<{ instituteLogin: { user: UserType } }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            user { id abilityRules }
          }
        }`,
        { username: E2E_USERS.STUDENT.username, password: E2E_USERS.STUDENT.password },
      );

      assert(res.data);
      const { user } = res.data.instituteLogin;
      assert(user);
      const userId = user.id;
      const rules = user.abilityRules ?? [];
      const attendanceRule = rules.find((r) => r.action === 'read' && r.subject === 'Attendance');
      expect(attendanceRule).toBeDefined();
      // ${user.id} should be resolved to the actual student user ID
      expect(attendanceRule?.conditions).toEqual({ studentId: userId });
    });

    it('should reject instituteLogin with wrong password', async () => {
      const res = await gql(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            accessToken
          }
        }`,
        { username: E2E_USERS.INSTITUTE_ADMIN.username, password: 'wrong' },
      );

      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].message).toBe('Invalid credentials');
    });

    it('should reject instituteLogin with non-existent user', async () => {
      const res = await gql(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            accessToken
          }
        }`,
        { username: 'nobody', password: 'pass' },
      );

      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].message).toBe('Invalid credentials');
    });
  });

  describe('adminLogin', () => {
    it('should return platform-scoped accessToken for platform admin', async () => {
      const res = await gql<{ adminLogin: AuthPayload }>(
        `mutation AdminLogin($username: String!, $password: String!) {
          adminLogin(username: $username, password: $password) {
            accessToken
            refreshToken
            user { id username email scope abilityRules }
          }
        }`,
        {
          username: E2E_USERS.PLATFORM_ADMIN.username,
          password: E2E_USERS.PLATFORM_ADMIN.password,
        },
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.adminLogin.accessToken).toBeTruthy();
      expect(res.data.adminLogin.refreshToken).toBeTruthy();
      expect(res.data.adminLogin.user.username).toBe(E2E_USERS.PLATFORM_ADMIN.username);
    });
  });

  describe('selectInstitute', () => {
    it('should reject selectInstitute with invalid selectionToken', async () => {
      const res = await gql(
        `mutation { selectInstitute(selectionToken: "invalid-token", membershipId: "fake-membership-id") { accessToken } }`,
      );
      expect(res.errors).toBeDefined();
    });

    it('should reject selectInstitute for a membership the user does not have', async () => {
      // Get a valid selectionToken first
      const loginRes = await gql<{ instituteLogin: InstituteLoginResult }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            selectionToken
          }
        }`,
        {
          username: E2E_USERS.INSTITUTE_ADMIN.username,
          password: E2E_USERS.INSTITUTE_ADMIN.password,
        },
      );
      assert(loginRes.data);
      const selectionToken = loginRes.data.instituteLogin.selectionToken;

      const res = await gql(
        `mutation SelectInstitute($selectionToken: String!, $membershipId: String!) {
          selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) { accessToken }
        }`,
        { selectionToken, membershipId: '00000000-0000-0000-0000-000000000000' },
      );
      expect(res.errors).toBeDefined();
    });
  });

  describe('me query', () => {
    it('should return current user with valid token', async () => {
      const res = await gql<{ me: UserType }>(
        'query { me { id username email tenantId roleId abilityRules } }',
        undefined,
        adminAccessToken,
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.me.username).toBe(E2E_USERS.INSTITUTE_ADMIN.username);
      expect(res.data.me.abilityRules).toBeDefined();
    });

    it('should reject me query without token', async () => {
      const res = await gql('query { me { id username } }');

      expect(res.errors).toBeDefined();
    });

    it('should reject me query with invalid token', async () => {
      const res = await gql('query { me { id username } }', undefined, 'invalid-token');

      expect(res.errors).toBeDefined();
    });
  });

  describe('refresh token', () => {
    it('should issue new tokens with valid refresh token', async () => {
      const res = await gql<{ refreshToken: AuthPayload }>(
        `mutation RefreshToken($token: String!) {
          refreshToken(token: $token) {
            accessToken
            refreshToken
            user { id username }
          }
        }`,
        { token: adminRefreshToken },
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.refreshToken.accessToken).toBeTruthy();
      expect(res.data.refreshToken.refreshToken).toBeTruthy();
      expect(res.data.refreshToken.user.username).toBe(E2E_USERS.INSTITUTE_ADMIN.username);

      // New refresh token should be different (rotation)
      expect(res.data.refreshToken.refreshToken).not.toBe(adminRefreshToken);
    });

    it('should reject reused refresh token (rotation)', async () => {
      // adminRefreshToken was already used above, so reusing it should fail
      const res = await gql(
        `mutation RefreshToken($token: String!) {
          refreshToken(token: $token) {
            accessToken
          }
        }`,
        { token: adminRefreshToken },
      );

      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].message).toMatch(/reuse detected|Invalid refresh token/i);
    });
  });

  describe('logout', () => {
    it('should logout successfully with valid token', async () => {
      // Get a fresh token first
      const loginRes = await gql<{ instituteLogin: InstituteLoginResult }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            accessToken
          }
        }`,
        { username: E2E_USERS.TEACHER.username, password: E2E_USERS.TEACHER.password },
      );
      assert(loginRes.data);
      const token = loginRes.data.instituteLogin.accessToken ?? undefined;

      const res = await gql<{ logout: boolean }>('mutation { logout }', undefined, token);

      expect(res.errors).toBeUndefined();
      assert(res.data);
      expect(res.data.logout).toBe(true);
    });

    it('should invalidate refresh tokens after logout', async () => {
      const loginRes = await gql<{ instituteLogin: InstituteLoginResult }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            accessToken
            refreshToken
          }
        }`,
        { username: E2E_USERS.STUDENT.username, password: E2E_USERS.STUDENT.password },
      );
      assert(loginRes.data);
      const { accessToken, refreshToken } = loginRes.data.instituteLogin;

      // Logout
      await gql('mutation { logout }', undefined, accessToken ?? undefined);

      // Attempting to use the refresh token should fail
      const refreshRes = await gql<{ refreshToken: AuthPayload }>(
        `mutation RefreshToken($token: String!) {
          refreshToken(token: $token) {
            accessToken
          }
        }`,
        { token: refreshToken },
      );

      expect(refreshRes.errors).toBeDefined();
    });
  });
});
