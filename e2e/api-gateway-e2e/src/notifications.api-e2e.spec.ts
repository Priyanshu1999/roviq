/**
 * Notifications domain E2E tests — migrated from
 * e2e/api-gateway-e2e/hurl/novu/{01-novu-api-smoke,02-login-notification}.hurl.
 *
 * "Novu" is an implementation detail; the domain term is "notifications".
 *
 * Covers:
 *   - Novu API smoke (Hurl 01): health + subscriber CRUD + list notifications
 *     against the self-hosted Novu instance.
 *   - Login notification flow (Hurl 02): instituteLogin + selectInstitute →
 *     NATS `auth.security` LOGIN event → notification-service → Novu trigger
 *     → notification visible on the user's Novu inbox within 30s.
 *
 * Runtime requirements:
 *   - `pnpm e2e:up` has been run (api-gateway + notification-service +
 *     novu-api + novu-bootstrap + novu-bridge-sync all healthy).
 *   - `docker/compose.e2e.yaml` publishes `novu-api` at host port 3443.
 *   - Novu credentials are resolved via `helpers/novu.ts`: first from env,
 *     then from the `roviq-e2e_novu_creds` docker volume.
 *
 * If credentials cannot be resolved, the entire suite skips with a clear
 * message rather than failing — the stack may not be up or the publish may
 * have been removed.
 */
import assert from 'node:assert';
import { beforeAll, describe, expect, it } from 'vitest';

import { E2E_USERS } from '../../shared/e2e-users';
import { gql } from './helpers/gql-client';
import {
  deleteNovuSubscriber,
  ensureNovuSubscriber,
  getNovuCreds,
  listNovuNotifications,
  novuHealth,
  waitForNotification,
} from './helpers/novu';

// Resolve creds once up front. If unavailable, mark the whole suite skipped
// with a descriptive reason (Vitest renders the reason in the test report).
let skipReason: string | undefined;
try {
  getNovuCreds();
} catch (err) {
  skipReason = err instanceof Error ? err.message : String(err);
}
const describeOrSkip = skipReason ? describe.skip.bind(describe) : describe.bind(null);

// Top-level annotation so the reason shows up in the test report when skipped.
if (skipReason) {
  console.warn(`[notifications.api-e2e] skipped: ${skipReason}`);
}

describeOrSkip('Notifications E2E', () => {
  // ─────────────────────────────────────────────────────
  // Hurl 01 — Novu API smoke
  // ─────────────────────────────────────────────────────
  describe('Novu API smoke', () => {
    const SMOKE_SUBSCRIBER = 'e2e-smoke-user';

    it('reports a healthy self-hosted Novu instance', async () => {
      const health = (await novuHealth()) as {
        data?: { status?: string; details?: { db?: { status?: string } } };
      };
      expect(health.data?.status).toBe('ok');
      expect(health.data?.details?.db?.status).toBe('up');
    });

    it('creates, reads, lists, and deletes a subscriber', async () => {
      // Clean up any leftover subscriber from a previous run so the create
      // path exercises the 201 branch.
      await deleteNovuSubscriber(SMOKE_SUBSCRIBER);

      await ensureNovuSubscriber(SMOKE_SUBSCRIBER, {
        firstName: 'E2E',
        lastName: 'Smoke',
        email: 'smoke@roviq.dev',
      });

      // Verify via list (filtered by subscriberId) — Novu's GET /v1/subscribers/{id}
      // is equivalent, but listNovuNotifications exercises the same route
      // shape already. Hit the subscribers route directly.
      const { apiUrl, apiKey } = getNovuCreds();
      const getRes = await fetch(
        `${apiUrl}/v1/subscribers/${encodeURIComponent(SMOKE_SUBSCRIBER)}`,
        { headers: { Authorization: `ApiKey ${apiKey}` } },
      );
      expect(getRes.status).toBe(200);
      const getBody = (await getRes.json()) as {
        data?: { subscriberId?: string; firstName?: string };
      };
      expect(getBody.data?.subscriberId).toBe(SMOKE_SUBSCRIBER);
      expect(getBody.data?.firstName).toBe('E2E');

      // Notifications list endpoint — empty is fine, proves it works.
      const page = await listNovuNotifications(SMOKE_SUBSCRIBER);
      expect(Array.isArray(page.data)).toBe(true);

      await deleteNovuSubscriber(SMOKE_SUBSCRIBER);
    });
  });

  // ─────────────────────────────────────────────────────
  // Hurl 02 — login → NATS auth.security → Novu notification
  // ─────────────────────────────────────────────────────
  describe('Login notification flow', () => {
    let userId: string;

    beforeAll(async () => {
      // instituteLogin (multi-institute admin path) returns userId +
      // selectionToken + memberships — same shape Hurl 02 captures.
      const loginRes = await gql<{
        instituteLogin: {
          requiresInstituteSelection: boolean;
          selectionToken: string;
          userId: string;
          memberships: { membershipId: string; tenantId: string }[];
        };
      }>(
        `mutation InstituteLogin($username: String!, $password: String!) {
          instituteLogin(username: $username, password: $password) {
            requiresInstituteSelection
            selectionToken
            userId
            memberships { membershipId tenantId }
          }
        }`,
        {
          username: E2E_USERS.INSTITUTE_ADMIN.username,
          password: E2E_USERS.INSTITUTE_ADMIN.password,
        },
      );
      expect(loginRes.errors).toBeUndefined();
      const login = loginRes.data?.instituteLogin;
      assert(login);
      expect(login.requiresInstituteSelection).toBe(true);
      assert(login.userId);
      assert(login.memberships[0]);
      userId = login.userId;

      // selectInstitute — exchanges selectionToken for an institute-scoped
      // access token. We don't use the token further, but the mutation must
      // succeed to ensure the LOGIN auth.security event is emitted for the
      // chosen membership (same as Hurl 02 Step 2).
      const selectRes = await gql<{
        selectInstitute: { accessToken: string };
      }>(
        `mutation SelectInstitute($selectionToken: String!, $membershipId: String!) {
          selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) {
            accessToken
          }
        }`,
        {
          selectionToken: login.selectionToken,
          membershipId: login.memberships[0].membershipId,
        },
      );
      expect(selectRes.errors).toBeUndefined();
      assert(selectRes.data?.selectInstitute.accessToken);
    });

    it('delivers a new-sign-in notification to the user within 30s', async () => {
      // Ensure the subscriber exists (idempotent; status < 500 is OK).
      await ensureNovuSubscriber(userId);
      // Poll Novu until the notification-service propagates the login event.
      await waitForNotification(userId, 30_000);
      const page = await listNovuNotifications(userId);
      expect(Array.isArray(page.data)).toBe(true);
      expect(page.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
