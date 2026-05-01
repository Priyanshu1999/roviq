/**
 * Password Change E2E (ROV-187).
 *
 * Validates the changePassword mutation end-to-end against the post-ROV-187 contract:
 *   - returns Boolean! (no token blob); caller must re-login
 *   - all refresh tokens for the user are revoked on success
 *   - min new password length is `NEW_PASSWORD_MIN_LENGTH` (@roviq/common-types)
 *   - new password must differ from current
 *   - wrong current password is rejected with UnauthorizedException
 *   - login with the new password works after the rotation
 *
 * The guardian1 seed user is used as the test subject because they are rarely
 * exercised by other E2E suites. The afterAll hook restores the original
 * password so re-runs in a long-lived e2e stack stay hermetic.
 */
import assert from 'node:assert';
import { NEW_PASSWORD_MIN_LENGTH } from '@roviq/common-types';
import type { InstituteLoginResult } from '@roviq/graphql/generated';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { E2E_USERS } from '../../shared/seed-fixtures';
import { gql } from './helpers/gql-client';

const ORIGINAL_PASSWORD = E2E_USERS.GUARDIAN.password;
const NEW_PASSWORD = 'Rotated-Password-2026!';

async function loginGuardian(password: string) {
  const res = await gql<{ instituteLogin: InstituteLoginResult }>(
    `mutation($username: String!, $password: String!) {
      instituteLogin(username: $username, password: $password) {
        accessToken
        refreshToken
      }
    }`,
    { username: E2E_USERS.GUARDIAN.username, password },
  );
  return res;
}

describe('Password Change E2E (ROV-187)', () => {
  let accessToken: string;
  let originalRefreshToken: string;
  let passwordWasChanged = false;

  beforeAll(async () => {
    const res = await loginGuardian(ORIGINAL_PASSWORD);
    if (res.errors?.length) {
      throw new Error(`guardian login failed: ${res.errors[0].message}`);
    }
    assert(res.data);
    const login = res.data.instituteLogin;
    assert(login.accessToken, 'guardian should be single-institute → direct accessToken');
    assert(login.refreshToken);
    accessToken = login.accessToken;
    originalRefreshToken = login.refreshToken;
  });

  afterAll(async () => {
    if (!passwordWasChanged) return;
    // Restore the original password so the test suite is re-runnable.
    const loginRes = await loginGuardian(NEW_PASSWORD);
    const token = loginRes.data?.instituteLogin.accessToken;
    if (!token) {
      console.warn('Could not re-login with new password — manual reset required');
      return;
    }
    const restoreRes = await gql<{ changePassword: boolean }>(
      `mutation($cur: String!, $next: String!) {
        changePassword(currentPassword: $cur, newPassword: $next)
      }`,
      { cur: NEW_PASSWORD, next: ORIGINAL_PASSWORD },
      token,
    );
    if (restoreRes.errors?.length) {
      console.warn('Could not restore original password:', restoreRes.errors[0].message);
    }
  });

  // ── Validation errors (do NOT mutate password) ─────────────

  it('rejects wrong current password with "Current password is incorrect"', async () => {
    const res = await gql(
      `mutation($cur: String!, $next: String!) {
        changePassword(currentPassword: $cur, newPassword: $next)
      }`,
      { cur: 'definitely-not-the-current-password', next: NEW_PASSWORD },
      accessToken,
    );
    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(/Current password is incorrect/i);
  });

  it(`rejects new password shorter than ${NEW_PASSWORD_MIN_LENGTH} characters with min-length error`, async () => {
    // `a` repeated `MIN - 1` times — one character short of the minimum.
    const tooShort = 'a'.repeat(NEW_PASSWORD_MIN_LENGTH - 1);
    const res = await gql(
      `mutation($cur: String!, $next: String!) {
        changePassword(currentPassword: $cur, newPassword: $next)
      }`,
      { cur: ORIGINAL_PASSWORD, next: tooShort },
      accessToken,
    );
    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(new RegExp(`${NEW_PASSWORD_MIN_LENGTH} characters`, 'i'));
  });

  it('rejects when new password equals current with "differ" error', async () => {
    const res = await gql(
      `mutation($cur: String!, $next: String!) {
        changePassword(currentPassword: $cur, newPassword: $next)
      }`,
      { cur: ORIGINAL_PASSWORD, next: ORIGINAL_PASSWORD },
      accessToken,
    );
    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(/differ/i);
  });

  it('rejects without an access token', async () => {
    const res = await gql(
      `mutation($cur: String!, $next: String!) {
        changePassword(currentPassword: $cur, newPassword: $next)
      }`,
      { cur: ORIGINAL_PASSWORD, next: NEW_PASSWORD },
    );
    expect(res.errors).toBeDefined();
  });

  // ── Successful change + invariants ─────────────────────────

  it('changePassword returns Boolean true and does not leak a token blob', async () => {
    const res = await gql<{ changePassword: boolean }>(
      `mutation($cur: String!, $next: String!) {
        changePassword(currentPassword: $cur, newPassword: $next)
      }`,
      { cur: ORIGINAL_PASSWORD, next: NEW_PASSWORD },
      accessToken,
    );

    expect(res.errors).toBeUndefined();
    assert(res.data);
    expect(res.data.changePassword).toBe(true);

    passwordWasChanged = true;
  });

  it('rejects the original refresh token after password change (all sessions revoked)', async () => {
    const res = await gql<{ refreshToken: { accessToken: string } }>(
      `mutation($token: String!) {
        refreshToken(token: $token) { accessToken }
      }`,
      { token: originalRefreshToken },
    );

    expect(res.errors).toBeDefined();
    assert(res.errors);
    // Service revokes all refresh tokens AND password_changed_at fence kicks
    // in. Three surfaces are acceptable — all mean the token was refused:
    //   - "Invalid refresh token" / "expired" — plain revocation
    //   - "password" — password_changed_at fence
    //   - "reuse" — refresh-token-reuse detector (the service now revokes the
    //     whole family on second use, which is exactly what we want post
    //     password change)
    expect(res.errors[0].message).toMatch(/Invalid refresh token|expired|password|reuse|revoked/i);
  });

  it('allows login with the new password', async () => {
    const res = await loginGuardian(NEW_PASSWORD);
    expect(res.errors).toBeUndefined();
    assert(res.data);
    expect(res.data.instituteLogin.accessToken).toBeTruthy();
  });

  it('rejects login with the old password', async () => {
    const res = await loginGuardian(ORIGINAL_PASSWORD);
    expect(res.errors).toBeDefined();
    assert(res.errors);
    expect(res.errors[0].message).toMatch(/invalid credentials|no account found/i);
  });
});
