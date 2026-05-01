import assert from 'node:assert';
import type {
  AuthPayload,
  ImpersonationAuthPayload,
  InstituteLoginResult,
  StartImpersonationResult,
} from '@roviq/graphql/generated';
import { describe, expect, it } from 'vitest';
import { SEED_IDS } from '../../../scripts/seed-ids';
import { E2E_USERS } from '../../shared/e2e-users';
import { E2eMeDocument } from './__generated__/graphql';
import { loginAsPlatformAdmin, loginAsTeacher } from './helpers/auth';
import { gql } from './helpers/gql-client';

// Strip only the trailing `/graphql` so the NestJS global prefix (`/api`)
// stays intact — `POST /api/graphql` (GraphQL) vs `GET /api/auth/ws-ticket`
// (REST controller) both live under `/api`. Dropping `/api/graphql` wholesale
// would route ws-ticket requests to `/auth/ws-ticket` → 404.
const API_BASE_URL = (process.env.API_URL || 'http://localhost:3004/api/graphql').replace(
  /\/graphql$/,
  '',
);

describe('Security Invariant E2E Tests', () => {
  // ── 7. Impersonation token cannot be refreshed ──────────────────────
  describe('7 — Impersonation token has no refresh token', () => {
    it('exchangeImpersonationCode returns accessToken but NO refreshToken field', async () => {
      // The ImpersonationAuthPayload GraphQL type only has `accessToken`, `user`, and `institute`.
      // There is no `refreshToken` field at all — attempting to query it should return a GraphQL
      // validation error, proving impersonation tokens are non-renewable by design.
      // We don't need to actually impersonate — just verify the schema rejects the field.
      const res = await gql(
        `mutation {
          exchangeImpersonationCode(code: "fake-code") {
            accessToken
            refreshToken
          }
        }`,
      );

      // The GraphQL schema should reject `refreshToken` on ImpersonationAuthPayload
      expect(res.errors).toBeDefined();
      assert(res.errors);
      const fieldError = res.errors.some(
        (e) => e.message.includes('refreshToken') || e.message.includes('Cannot query field'),
      );
      expect(fieldError).toBe(true);
    });
  });

  // ── 8. Revoked impersonation session rejects requests ───────────────
  describe('8 — Revoked impersonation session rejects requests', () => {
    it('impersonation accessToken is rejected after endImpersonation', async () => {
      // 1. Platform admin starts impersonation of the teacher in institute 1
      const { accessToken: adminToken } = await loginAsPlatformAdmin();
      const startRes = await gql<{ adminStartImpersonation: StartImpersonationResult }>(
        `mutation AdminStartImpersonation($targetUserId: String!, $targetTenantId: String!, $reason: String!) {
          adminStartImpersonation(
            targetUserId: $targetUserId,
            targetTenantId: $targetTenantId,
            reason: $reason
          ) { code }
        }`,
        {
          targetUserId: SEED_IDS.USER_TEACHER,
          targetTenantId: SEED_IDS.INSTITUTE_1,
          reason: 'security invariant test — revoked session rejection',
        },
        adminToken,
      );
      expect(startRes.errors).toBeUndefined();
      assert(startRes.data);
      const code = startRes.data.adminStartImpersonation.code;
      assert(code);

      // 2. Exchange the one-time code for an impersonation access token
      const exchangeRes = await gql<{ exchangeImpersonationCode: ImpersonationAuthPayload }>(
        `mutation($code: String!) {
          exchangeImpersonationCode(code: $code) {
            accessToken
            user { id }
          }
        }`,
        { code },
      );
      expect(exchangeRes.errors).toBeUndefined();
      assert(exchangeRes.data);
      const impersonationToken = exchangeRes.data.exchangeImpersonationCode.accessToken;
      assert(impersonationToken);

      // 3. Verify impersonation token works initially
      const meRes1 = await gql<{ me: { id: string } }>(
        'query { me { id } }',
        undefined,
        impersonationToken,
      );
      expect(meRes1.errors).toBeUndefined();

      // 4. End the impersonation (either party can end — use the impersonator here)
      //    We need the sessionId from the JWT itself.
      const payload = JSON.parse(
        Buffer.from(impersonationToken.split('.')[1], 'base64url').toString('utf8'),
      ) as { impersonationSessionId: string };
      const sessionId = payload.impersonationSessionId;
      assert(sessionId);

      const endRes = await gql<{ endImpersonation: boolean }>(
        `mutation($sessionId: String!) { endImpersonation(sessionId: $sessionId) }`,
        { sessionId },
        impersonationToken,
      );
      expect(endRes.errors).toBeUndefined();

      // 5. The impersonation token should now be rejected by ImpersonationSessionGuard
      const meRes2 = await gql(E2eMeDocument, undefined, impersonationToken);
      expect(meRes2.errors).toBeDefined();
      assert(meRes2.errors);
      expect(meRes2.errors[0].message).toMatch(/session|unauthor|ended|forbidden|invalid/i);
    });
  });

  // ── 12. Wrong portal returns "No account found" ─────────────────────
  describe('12 — Wrong portal returns "No account found"', () => {
    it('instituteLogin with admin credentials should work (admin has institute memberships)', async () => {
      const res = await gql<{ instituteLogin: InstituteLoginResult }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            requiresInstituteSelection
            memberships { membershipId }
          }
        }`,
        {
          username: E2E_USERS.INSTITUTE_ADMIN.username,
          password: E2E_USERS.INSTITUTE_ADMIN.password,
        },
      );

      expect(res.errors).toBeUndefined();
      assert(res.data);
      // Admin has institute memberships, so login should succeed
      expect(
        res.data.instituteLogin.requiresInstituteSelection ||
          (res.data.instituteLogin.memberships?.length ?? 0) > 0,
      ).toBe(true);
    });

    it('resellerLogin with teacher credentials should fail with "No account found"', async () => {
      const res = await gql<{ resellerLogin: AuthPayload }>(
        `mutation ResellerLogin($username: String!, $password: String!) {
          resellerLogin(username: $username, password: $password) {
            accessToken
          }
        }`,
        { username: E2E_USERS.TEACHER.username, password: E2E_USERS.TEACHER.password },
      );

      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(
        /No account found|Invalid credentials|No reseller membership/i,
      );
    });

    it('adminLogin with teacher credentials should fail with "No account found"', async () => {
      const res = await gql<{ adminLogin: AuthPayload }>(
        `mutation AdminLogin($username: String!, $password: String!) {
          adminLogin(username: $username, password: $password) {
            accessToken
          }
        }`,
        { username: E2E_USERS.TEACHER.username, password: E2E_USERS.TEACHER.password },
      );

      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(
        /No account found|Invalid credentials|No platform membership/i,
      );
    });
  });

  // ── 14. One-time impersonation code cannot be reused ────────────────
  describe('14 — One-time impersonation code cannot be reused', () => {
    it('exchangeImpersonationCode rejects the second exchange with the same code', async () => {
      const { accessToken: adminToken } = await loginAsPlatformAdmin();

      const startRes = await gql<{ adminStartImpersonation: StartImpersonationResult }>(
        `mutation AdminStartImpersonation($targetUserId: String!, $targetTenantId: String!, $reason: String!) {
          adminStartImpersonation(
            targetUserId: $targetUserId,
            targetTenantId: $targetTenantId,
            reason: $reason
          ) { code }
        }`,
        {
          targetUserId: SEED_IDS.USER_TEACHER,
          targetTenantId: SEED_IDS.INSTITUTE_1,
          reason: 'security invariant test — single-use impersonation code',
        },
        adminToken,
      );
      assert(startRes.data);
      const code = startRes.data.adminStartImpersonation.code;

      // First exchange — should succeed (GETDEL consumes the code atomically)
      const first = await gql<{ exchangeImpersonationCode: ImpersonationAuthPayload }>(
        `mutation($code: String!) { exchangeImpersonationCode(code: $code) { accessToken } }`,
        { code },
      );
      expect(first.errors).toBeUndefined();
      assert(first.data);
      expect(first.data.exchangeImpersonationCode.accessToken).toBeTruthy();

      // Second exchange — the Redis key has been consumed; must be rejected
      const second = await gql(
        `mutation($code: String!) { exchangeImpersonationCode(code: $code) { accessToken } }`,
        { code },
      );
      expect(second.errors).toBeDefined();
      assert(second.errors);
      expect(second.errors[0].message).toMatch(/expired or already used|invalid|unauthor/i);
    });
  });

  // ── 15. Intra-institute impersonation respects role hierarchy ───────
  describe('15 — Intra-institute impersonation respects role hierarchy', () => {
    it('teacher cannot impersonate admin (higher role)', async () => {
      const { accessToken } = await loginAsTeacher();

      const res = await gql<{ impersonateUser: StartImpersonationResult }>(
        `mutation ImpersonateUser($targetUserId: String!, $reason: String!) {
          impersonateUser(targetUserId: $targetUserId, reason: $reason) {
            code
            requiresOtp
          }
        }`,
        {
          targetUserId: SEED_IDS.USER_ADMIN,
          reason: 'testing role hierarchy enforcement for security audit',
        },
        accessToken,
      );

      // Should be rejected — teacher cannot impersonate admin
      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(/permission|forbidden|cannot impersonate|higher role/i);
    });
  });

  // ── 16. Institute switching returns new tokens ──────────────────────
  describe('16 — Institute switching returns new tokens', () => {
    it('switchInstitute returns new access and refresh tokens for the target institute', async () => {
      // Login as admin and select first institute
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
      const memberships = loginRes.data.instituteLogin.memberships ?? [];
      assert(memberships.length >= 2, 'Admin must have at least 2 institute memberships');

      const firstMembership = memberships[0];
      const secondMembership = memberships[1];

      // Select first institute using selectionToken
      const selectRes = await gql<{ selectInstitute: AuthPayload }>(
        `mutation SelectInstitute($selectionToken: String!, $membershipId: String!) {
          selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) {
            accessToken
            refreshToken
          }
        }`,
        { selectionToken, membershipId: firstMembership.membershipId },
      );

      assert(selectRes.data);
      const firstAccessToken = selectRes.data.selectInstitute.accessToken;
      const firstRefreshToken = selectRes.data.selectInstitute.refreshToken;
      assert(firstAccessToken);
      assert(firstRefreshToken);

      // Switch to second institute
      const switchRes = await gql<{ switchInstitute: AuthPayload }>(
        `mutation SwitchInstitute($membershipId: String!, $currentRefreshToken: String!) {
          switchInstitute(membershipId: $membershipId, currentRefreshToken: $currentRefreshToken) {
            accessToken
            refreshToken
            user { tenantId }
          }
        }`,
        { membershipId: secondMembership.membershipId, currentRefreshToken: firstRefreshToken },
        firstAccessToken,
      );

      expect(switchRes.errors).toBeUndefined();
      assert(switchRes.data);
      const newAccessToken = switchRes.data.switchInstitute.accessToken;
      const newRefreshToken = switchRes.data.switchInstitute.refreshToken;

      // New tokens should be issued
      expect(newAccessToken).toBeTruthy();
      expect(newRefreshToken).toBeTruthy();

      // Tokens should be different from the first institute's tokens
      expect(newAccessToken).not.toBe(firstAccessToken);
      expect(newRefreshToken).not.toBe(firstRefreshToken);

      // New token should be scoped to the second institute
      const switchedUser = switchRes.data.switchInstitute.user;
      assert(switchedUser);
      expect(switchedUser.tenantId).toBe(secondMembership.tenantId);

      // Note: switchInstitute currently does NOT revoke the old refresh token
      // (currentRefreshTokenId is passed as undefined from the resolver).
      // When that is wired up, add a test here to verify the old refresh token is rejected.
    });
  });

  // ── 17. Reseller cannot delete institutes ───────────────────────────
  describe('17 — Reseller cannot delete institutes', () => {
    it.skip('no deleteInstitute mutation exists for reseller scope yet — skipped', () => {
      // When a reseller-scoped deleteInstitute mutation is added,
      // verify that reseller users cannot call it (only platform admin can).
    });
  });

  // ── 18. System reseller cannot be suspended or deleted ──────────────
  describe('18 — System reseller cannot be suspended or deleted', () => {
    it('adminSuspendReseller with Roviq Direct UUID should be rejected', async () => {
      const { accessToken: adminToken } = await loginAsPlatformAdmin();

      // Try to suspend the system reseller "Roviq Direct"
      const res = await gql<{ adminSuspendReseller: boolean }>(
        `mutation SuspendReseller($resellerId: String!) {
          adminSuspendReseller(resellerId: $resellerId)
        }`,
        { resellerId: SEED_IDS.RESELLER_DIRECT },
        adminToken,
      );

      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(/cannot suspend system reseller|forbidden/i);
    });

    it('adminDeleteReseller with Roviq Direct UUID should be rejected', async () => {
      const { accessToken: adminToken } = await loginAsPlatformAdmin();

      // Try to delete the system reseller "Roviq Direct"
      const res = await gql<{ adminDeleteReseller: boolean }>(
        `mutation DeleteReseller($resellerId: String!) {
          adminDeleteReseller(resellerId: $resellerId)
        }`,
        { resellerId: SEED_IDS.RESELLER_DIRECT },
        adminToken,
      );

      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(/cannot delete system reseller|forbidden/i);
    });
  });

  // ── 19. ws-ticket is single-use and expires ─────────────────────────
  describe('19 — ws-ticket requires auth and issues a fresh per-request ticket', () => {
    it('rejects unauthenticated ws-ticket requests', async () => {
      const res = await fetch(`${API_BASE_URL}/auth/ws-ticket`, { method: 'GET' });
      expect(res.status).toBe(401);
    });

    it('issues a fresh ticket on each authenticated call (never the same token twice)', async () => {
      const { accessToken } = await loginAsTeacher();

      const res1 = await fetch(`${API_BASE_URL}/auth/ws-ticket`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as { ticket?: string };
      expect(body1.ticket).toBeTruthy();
      expect(typeof body1.ticket).toBe('string');
      expect(body1.ticket?.length).toBeGreaterThanOrEqual(32);

      const res2 = await fetch(`${API_BASE_URL}/auth/ws-ticket`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as { ticket?: string };
      expect(body2.ticket).toBeTruthy();

      // Each request must mint a distinct single-use ticket
      expect(body2.ticket).not.toBe(body1.ticket);
    });
  });

  // ── 20. revokeAllOtherSessions keeps the current session alive ──────
  describe('20 — revokeAllOtherSessions keeps the current session alive', () => {
    it('session A calling revokeAllOther keeps A alive and kills B', async () => {
      // Two independent logins as teacher → two refresh token rows
      const loginA = await gql<{ instituteLogin: InstituteLoginResult }>(
        `mutation($u: String!, $p: String!) {
          instituteLogin(username: $u, password: $p) { accessToken refreshToken }
        }`,
        { u: E2E_USERS.TEACHER.username, p: E2E_USERS.TEACHER.password },
      );
      const loginB = await gql<{ instituteLogin: InstituteLoginResult }>(
        `mutation($u: String!, $p: String!) {
          instituteLogin(username: $u, password: $p) { accessToken refreshToken }
        }`,
        { u: E2E_USERS.TEACHER.username, p: E2E_USERS.TEACHER.password },
      );
      assert(loginA.data?.instituteLogin.accessToken);
      assert(loginA.data.instituteLogin.refreshToken);
      assert(loginB.data?.instituteLogin.refreshToken);

      const tokenA_access = loginA.data.instituteLogin.accessToken;
      const tokenA_refresh = loginA.data.instituteLogin.refreshToken;
      const tokenB_refresh = loginB.data.instituteLogin.refreshToken;

      // Session A revokes all other sessions
      const revokeRes = await gql<{ revokeAllOtherSessions: boolean }>(
        `mutation($t: String!) { revokeAllOtherSessions(currentRefreshToken: $t) }`,
        { t: tokenA_refresh },
        tokenA_access,
      );
      expect(revokeRes.errors).toBeUndefined();

      // B's refresh token should now be rejected
      const refreshB = await gql(
        `mutation($t: String!) { refreshToken(token: $t) { accessToken } }`,
        { t: tokenB_refresh },
      );
      expect(refreshB.errors).toBeDefined();

      // A's refresh token should still work (it was the "keep-alive" session)
      const refreshA = await gql<{ refreshToken: AuthPayload }>(
        `mutation($t: String!) { refreshToken(token: $t) { accessToken refreshToken } }`,
        { t: tokenA_refresh },
      );
      expect(refreshA.errors).toBeUndefined();
      assert(refreshA.data);
      expect(refreshA.data.refreshToken.accessToken).toBeTruthy();
    });
  });

  // ── 21. selectInstitute requires a valid selectionToken ─────────────
  describe('21 — selectInstitute requires a valid selectionToken', () => {
    it('rejects an obviously invalid selectionToken', async () => {
      const res = await gql(
        `mutation($t: String!, $m: String!) {
          selectInstitute(selectionToken: $t, membershipId: $m) { accessToken }
        }`,
        { t: 'not-a-jwt', m: '00000000-0000-0000-0000-000000000000' },
      );
      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(/selection token|unauthor|invalid/i);
    });

    it('rejects an expired/tampered selectionToken', async () => {
      // Structurally valid JWT but not signed with the right secret
      const fakeToken =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4IiwicHVycG9zZSI6Imluc3RpdHV0ZS1zZWxlY3Rpb24iLCJleHAiOjF9.fake';
      const res = await gql(
        `mutation($t: String!, $m: String!) {
          selectInstitute(selectionToken: $t, membershipId: $m) { accessToken }
        }`,
        { t: fakeToken, m: '00000000-0000-0000-0000-000000000000' },
      );
      expect(res.errors).toBeDefined();
      assert(res.errors);
      expect(res.errors[0].message).toMatch(/selection token|unauthor|invalid|expired/i);
    });
  });
});
