import type { FormattedExecutionResult } from 'graphql';
import { beforeAll, describe, expect, it } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000/api/graphql';

// biome-ignore lint/suspicious/noExplicitAny: e2e tests use dynamic GraphQL queries with varying response shapes
type GqlResult = FormattedExecutionResult<Record<string, any>>;

async function gql(
  query: string,
  variables?: Record<string, unknown>,
  token?: string,
): Promise<GqlResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<GqlResult>;
}

describe('Auth E2E', () => {
  let adminAccessToken: string;
  let adminRefreshToken: string;

  beforeAll(async () => {
    // Verify API is reachable
    const res = await gql('{ __typename }');
    expect(res.data?.__typename).toBe('Query');
  });

  describe('login', () => {
    it('should return platformToken + memberships for multi-institute user (admin)', async () => {
      const res = await gql(`
        mutation {
          login(username: "admin", password: "admin123") {
            accessToken
            refreshToken
            platformToken
            memberships { tenantId instituteName instituteSlug roleName }
          }
        }
      `);

      expect(res.errors).toBeUndefined();
      // Multi-institute user gets platformToken, not accessToken
      expect(res.data.login.platformToken).toBeTruthy();
      expect(res.data.login.accessToken).toBeNull();
      expect(res.data.login.memberships).toHaveLength(2);
      expect(res.data.login.memberships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ instituteName: 'Demo Institute', roleName: 'institute_admin' }),
          expect.objectContaining({
            instituteName: 'Second Institute',
            roleName: 'institute_admin',
          }),
        ]),
      );
    });

    it('should return accessToken directly for single-institute user (teacher1)', async () => {
      const res = await gql(`
        mutation {
          login(username: "teacher1", password: "teacher123") {
            accessToken
            refreshToken
            platformToken
            user { id username email tenantId roleId abilityRules }
          }
        }
      `);

      expect(res.errors).toBeUndefined();
      // Single-institute user gets accessToken directly
      expect(res.data.login.accessToken).toBeTruthy();
      expect(res.data.login.refreshToken).toBeTruthy();
      expect(res.data.login.platformToken).toBeNull();
      expect(res.data.login.user.username).toBe('teacher1');
    });

    it('should return manage-all ability rules for institute_admin via selectInstitute', async () => {
      // Login as admin (multi-institute) -> get platformToken
      const loginRes = await gql(`
        mutation {
          login(username: "admin", password: "admin123") {
            platformToken
            memberships { tenantId }
          }
        }
      `);
      const platformToken = loginRes.data.login.platformToken;
      const tenantId = loginRes.data.login.memberships[0].tenantId;

      // Select institute
      const res = await gql(
        `mutation SelectInstitute($tenantId: String!) {
          selectInstitute(tenantId: $tenantId) {
            accessToken
            refreshToken
            user { id username tenantId roleId abilityRules }
          }
        }`,
        { tenantId },
        platformToken,
      );

      expect(res.errors).toBeUndefined();
      expect(res.data.selectInstitute.accessToken).toBeTruthy();
      expect(res.data.selectInstitute.user.username).toBe('admin');
      expect(res.data.selectInstitute.user.tenantId).toBe(tenantId);

      const rules = res.data.selectInstitute.user.abilityRules;
      expect(rules).toEqual(
        expect.arrayContaining([expect.objectContaining({ action: 'manage', subject: 'all' })]),
      );

      // Store for later tests
      adminAccessToken = res.data.selectInstitute.accessToken;
      adminRefreshToken = res.data.selectInstitute.refreshToken;
    });

    it('should return limited ability rules for teacher', async () => {
      const res = await gql(`
        mutation {
          login(username: "teacher1", password: "teacher123") {
            user { abilityRules }
          }
        }
      `);

      const rules = res.data.login.user.abilityRules;
      expect(rules.length).toBeGreaterThan(1);

      // Teacher should have read:Student but NOT manage:all
      const hasReadStudent = rules.some(
        (r: { action: string; subject: string; conditions?: Record<string, unknown> }) =>
          r.action === 'read' && r.subject === 'Student',
      );
      const hasManageAll = rules.some(
        (r: { action: string; subject: string; conditions?: Record<string, unknown> }) =>
          r.action === 'manage' && r.subject === 'all',
      );
      expect(hasReadStudent).toBe(true);
      expect(hasManageAll).toBe(false);
    });

    it('should return student abilities with condition placeholder resolved', async () => {
      const res = await gql(`
        mutation {
          login(username: "student1", password: "student123") {
            user { id abilityRules }
          }
        }
      `);

      const userId = res.data.login.user.id;
      const rules = res.data.login.user.abilityRules;
      const attendanceRule = rules.find(
        (r: { action: string; subject: string; conditions?: Record<string, unknown> }) =>
          r.action === 'read' && r.subject === 'Attendance',
      );
      expect(attendanceRule).toBeDefined();
      // ${user.id} should be resolved to the actual student user ID
      expect(attendanceRule.conditions).toEqual({ studentId: userId });
    });

    it('should reject login with wrong password', async () => {
      const res = await gql(`
        mutation {
          login(username: "admin", password: "wrong") {
            accessToken
          }
        }
      `);

      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].message).toBe('Invalid credentials');
    });

    it('should reject login with non-existent user', async () => {
      const res = await gql(`
        mutation {
          login(username: "nobody", password: "pass") {
            accessToken
          }
        }
      `);

      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].message).toBe('Invalid credentials');
    });
  });

  describe('selectInstitute', () => {
    it('should reject selectInstitute without a token', async () => {
      const res = await gql(
        `mutation { selectInstitute(tenantId: "fake-tenant-id") { accessToken } }`,
      );

      expect(res.errors).toBeDefined();
    });

    it('should reject selectInstitute for a tenant the user has no membership in', async () => {
      const loginRes = await gql(`
        mutation {
          login(username: "admin", password: "admin123") { platformToken }
        }
      `);
      const platformToken = loginRes.data.login.platformToken;

      const res = await gql(
        `mutation { selectInstitute(tenantId: "00000000-0000-0000-0000-000000000000") { accessToken } }`,
        undefined,
        platformToken,
      );

      expect(res.errors).toBeDefined();
    });
  });

  describe('me query', () => {
    it('should return current user with valid token', async () => {
      const res = await gql(
        'query { me { id username email tenantId roleId abilityRules } }',
        undefined,
        adminAccessToken,
      );

      expect(res.errors).toBeUndefined();
      expect(res.data.me.username).toBe('admin');
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
      const res = await gql(`
        mutation {
          refreshToken(token: "${adminRefreshToken}") {
            accessToken
            refreshToken
            user { id username }
          }
        }
      `);

      expect(res.errors).toBeUndefined();
      expect(res.data.refreshToken.accessToken).toBeTruthy();
      expect(res.data.refreshToken.refreshToken).toBeTruthy();
      expect(res.data.refreshToken.user.username).toBe('admin');

      // New refresh token should be different (rotation)
      expect(res.data.refreshToken.refreshToken).not.toBe(adminRefreshToken);
    });

    it('should reject reused refresh token (rotation)', async () => {
      // adminRefreshToken was already used above, so reusing it should fail
      const res = await gql(`
        mutation {
          refreshToken(token: "${adminRefreshToken}") {
            accessToken
          }
        }
      `);

      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].message).toMatch(/reuse detected|Invalid refresh token/i);
    });
  });

  describe('logout', () => {
    it('should logout successfully with valid token', async () => {
      // Get a fresh token first
      const loginRes = await gql(`
        mutation {
          login(username: "teacher1", password: "teacher123") {
            accessToken
          }
        }
      `);
      const token = loginRes.data.login.accessToken;

      const res = await gql('mutation { logout }', undefined, token);

      expect(res.errors).toBeUndefined();
      expect(res.data.logout).toBe(true);
    });

    it('should invalidate refresh tokens after logout', async () => {
      const loginRes = await gql(`
        mutation {
          login(username: "student1", password: "student123") {
            accessToken
            refreshToken
          }
        }
      `);
      const { accessToken, refreshToken } = loginRes.data.login;

      // Logout
      await gql('mutation { logout }', undefined, accessToken);

      // Attempting to use the refresh token should fail
      const refreshRes = await gql(`
        mutation {
          refreshToken(token: "${refreshToken}") {
            accessToken
          }
        }
      `);

      expect(refreshRes.errors).toBeDefined();
    });
  });
});
