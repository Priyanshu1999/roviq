import { beforeAll, describe, expect, it } from 'vitest';

const API_URL = process.env.API_URL || 'http://localhost:3000/graphql';
const TENANT_ID = 'dfcab71f-4038-435a-8ca7-160f7ab312fe';

async function gql(query: string, variables?: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{ data?: any; errors?: any[] }>;
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
    it('should login as admin with correct credentials', async () => {
      const res = await gql(`
        mutation {
          login(username: "admin", password: "admin123", tenantId: "${TENANT_ID}") {
            accessToken
            refreshToken
            user { id username email tenantId roleId abilityRules }
          }
        }
      `);

      expect(res.errors).toBeUndefined();
      expect(res.data.login.accessToken).toBeTruthy();
      expect(res.data.login.refreshToken).toBeTruthy();
      expect(res.data.login.user.username).toBe('admin');
      expect(res.data.login.user.tenantId).toBe(TENANT_ID);

      adminAccessToken = res.data.login.accessToken;
      adminRefreshToken = res.data.login.refreshToken;
    });

    it('should return manage-all ability rules for institute_admin', async () => {
      const res = await gql(`
        mutation {
          login(username: "admin", password: "admin123", tenantId: "${TENANT_ID}") {
            user { abilityRules }
          }
        }
      `);

      const rules = res.data.login.user.abilityRules;
      expect(rules).toEqual(
        expect.arrayContaining([expect.objectContaining({ action: 'manage', subject: 'all' })]),
      );
    });

    it('should return limited ability rules for teacher', async () => {
      const res = await gql(`
        mutation {
          login(username: "teacher1", password: "teacher123", tenantId: "${TENANT_ID}") {
            user { abilityRules }
          }
        }
      `);

      const rules = res.data.login.user.abilityRules;
      expect(rules.length).toBeGreaterThan(1);

      // Teacher should have read:Student but NOT manage:all
      const hasReadStudent = rules.some((r: any) => r.action === 'read' && r.subject === 'Student');
      const hasManageAll = rules.some((r: any) => r.action === 'manage' && r.subject === 'all');
      expect(hasReadStudent).toBe(true);
      expect(hasManageAll).toBe(false);
    });

    it('should return student abilities with condition placeholder resolved', async () => {
      const res = await gql(`
        mutation {
          login(username: "student1", password: "student123", tenantId: "${TENANT_ID}") {
            user { id abilityRules }
          }
        }
      `);

      const userId = res.data.login.user.id;
      const rules = res.data.login.user.abilityRules;
      const attendanceRule = rules.find(
        (r: any) => r.action === 'read' && r.subject === 'Attendance',
      );
      expect(attendanceRule).toBeDefined();
      // ${user.id} should be resolved to the actual student user ID
      expect(attendanceRule.conditions).toEqual({ studentId: userId });
    });

    it('should reject login with wrong password', async () => {
      const res = await gql(`
        mutation {
          login(username: "admin", password: "wrong", tenantId: "${TENANT_ID}") {
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
          login(username: "nobody", password: "pass", tenantId: "${TENANT_ID}") {
            accessToken
          }
        }
      `);

      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].message).toBe('Invalid credentials');
    });

    it('should reject login with wrong tenantId', async () => {
      const res = await gql(`
        mutation {
          login(username: "admin", password: "admin123", tenantId: "00000000-0000-0000-0000-000000000000") {
            accessToken
          }
        }
      `);

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
      expect(res.data.me.tenantId).toBe(TENANT_ID);
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
          login(username: "teacher1", password: "teacher123", tenantId: "${TENANT_ID}") {
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
          login(username: "student1", password: "student123", tenantId: "${TENANT_ID}") {
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

  describe('cross-tenant isolation', () => {
    it('should reject login with valid credentials but wrong tenant', async () => {
      const res = await gql(`
        mutation {
          login(username: "admin", password: "admin123", tenantId: "00000000-0000-0000-0000-000000000001") {
            accessToken
          }
        }
      `);

      expect(res.errors).toBeDefined();
      expect(res.errors?.[0].message).toBe('Invalid credentials');
    });
  });
});
