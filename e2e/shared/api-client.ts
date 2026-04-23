/**
 * Minimal API-client helpers for Playwright tests that need to clean up
 * persistent data they created through the UI.
 *
 * Auth: reads the scope-appropriate access token from the browser's
 * `localStorage` (set by `auth.setup.ts`) and sends it as
 * `Authorization: Bearer …`. Cookies are NOT used for API auth in this
 * stack, so `page.request` without an explicit header is anonymous.
 *
 * Scope: the institute web app stores its token under
 * `__e2e_session__roviq-institute-access-token`; other scopes use the
 * equivalent `-platform-` / `-reseller-` keys. We currently only need the
 * institute scope, so that is the sole export — add more when required.
 */

import type { Page } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3004/api/graphql';
const INSTITUTE_TOKEN_KEY = '__e2e_session__roviq-institute-access-token';

async function instituteAccessToken(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), INSTITUTE_TOKEN_KEY);
}

/**
 * Deletes a student by id via the `deleteStudent` GraphQL mutation using
 * the active institute session. Swallows failures (logs to console) so a
 * cleanup hook never masks the actual test failure it's running after.
 */
export async function deleteStudentViaApi(page: Page, studentId: string): Promise<void> {
  const token = await instituteAccessToken(page);
  if (!token) {
    console.warn(`[cleanup] no institute access token — skipping deleteStudent(${studentId})`);
    return;
  }
  try {
    const res = await page.request.post(API_URL, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      data: {
        query: /* GraphQL */ `mutation DeleteStudentCleanup($id: ID!) { deleteStudent(id: $id) }`,
        variables: { id: studentId },
      },
    });
    if (!res.ok()) {
      console.warn(`[cleanup] deleteStudent(${studentId}) → HTTP ${res.status()}`);
    }
  } catch (err) {
    console.warn(`[cleanup] deleteStudent(${studentId}) threw:`, err);
  }
}

/**
 * Extracts the UUID from the students detail URL (`/people/students/{uuid}`
 * or the middleware-rewritten `/institute/people/students/{uuid}`). Returns
 * null when the URL does not match — callers should log that so they can
 * skip cleanup cleanly.
 */
export function extractStudentIdFromUrl(url: string): string | null {
  const match = url.match(/\/students\/([0-9a-f-]{36})(?:[/?#]|$)/);
  return match?.[1] ?? null;
}
