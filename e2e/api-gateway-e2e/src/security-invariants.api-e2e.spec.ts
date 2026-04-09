import assert from 'node:assert';
import type {
  AuthPayload,
  InstituteLoginResult,
  StartImpersonationResult,
} from '@roviq/graphql/generated';
import { describe, expect, it } from 'vitest';
import { SEED_IDS } from '../../../scripts/seed-ids';
import { E2E_USERS } from '../../shared/e2e-users';
import { loginAsPlatformAdmin, loginAsTeacher } from './helpers/auth';
import { gql } from './helpers/gql-client';

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
    // Blocked: test body not yet written. Redis IS now available in the E2E
    // stack, so the technical prerequisite is met. Implementation requires
    // writing a full multi-step impersonation flow:
    //   1. Login as platform admin → startImpersonation → get code
    //   2. exchangeImpersonationCode → get impersonation accessToken
    //   3. endImpersonation
    //   4. Verify the impersonation accessToken is rejected by ImpersonationSessionGuard
    it.skip('requires writing full impersonation flow — placeholder', () => {});
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
    // Blocked: test body not yet written. Redis IS now available in the E2E
    // stack, so the technical prerequisite is met. Implementation requires:
    //   1. Start impersonation → get one-time code
    //   2. Exchange code → success
    //   3. Exchange same code again → should fail with "expired or already used"
    it.skip('requires writing full impersonation flow — placeholder', () => {
      // Requires Redis to store and atomically consume the one-time code.
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
  describe('19 — ws-ticket is single-use and expires', () => {
    // Blocked: test body not yet written. Redis IS now available in the E2E
    // stack. Implementation should mock time or reduce ticket TTL for tests
    // to avoid the 31s wait noted in the original placeholder.
    it.skip('requires writing single-use + expiry assertions — placeholder', () => {
      // This test would:
      // 1. Request a ws-ticket
      // 2. Use it to connect — should succeed
      // 3. Try to use the same ticket again — should fail (single-use)
      // 4. Request a new ticket, wait 31s, try to use it — should fail (expired)
      // Requires Redis for ticket storage and a 31-second wait for TTL expiry.
    });
  });
});
