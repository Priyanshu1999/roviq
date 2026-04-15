/**
 * Impersonation flow — admin impersonates an institute user.
 *
 * Status: BLOCKED — The admin UI button that generates an impersonation code
 * and opens the institute session in a new tab is not yet implemented.
 * The backend exchange endpoint (exchangeImpersonationCode mutation) and the
 * impersonation landing page (/institute/auth/impersonate?code=...) exist, but
 * there is no visible UI in the admin portal to trigger the flow.
 *
 * These tests describe the INTENDED behaviour once the feature is wired.
 * Fill them in when the following are implemented:
 *   1. Admin institute detail → "Impersonate" button (generates code, opens tab)
 *   2. ImpersonationBanner component rendered in institute portal layout
 *   3. "Exit impersonation" button in the banner that clears the session
 *
 * Deferred tracking: .claude/sessions/a8ad88da-92a0-48c4-a5ec-a945dd66497a/todos.md
 */
import { test } from '../../shared/console-guardian';

test.describe('Impersonation flow', () => {
  test.skip('admin institute detail page has an "Impersonate" button that generates a one-time code', async () => {});

  test.skip('clicking Impersonate opens the institute portal in a new tab with an impersonation session', async () => {});

  test.skip('impersonated tab shows the ImpersonationBanner with the impersonator name and scope', async () => {});

  test.skip('original admin tab remains unchanged and unaffected while the impersonation tab is open', async () => {});

  test.skip('"Exit impersonation" button in the banner ends the session and closes/redirects the tab', async () => {});

  test.skip('impersonation event is recorded in the admin audit log (audit-logs-tab-impersonation)', async () => {});

  test.skip('impersonation token is stored in sessionStorage (not localStorage) so it dies with the tab', async () => {});

  test.skip('reloading the impersonated tab after the token expires redirects to the login page', async () => {});
});
