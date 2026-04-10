import type { Page } from '@playwright/test';

/**
 * Playwright's `storageState` only persists cookies + localStorage, NOT sessionStorage.
 * Our app stores access tokens in sessionStorage (via `createScopedTokenStorage`).
 *
 * This helper copies sessionStorage items to localStorage with a prefix so they
 * survive `storageState` serialization. The companion `restoreSessionStorage`
 * copies them back on each test's page load.
 */
export const E2E_SESSION_PREFIX = '__e2e_session__';

/**
 * Call AFTER login, BEFORE `context.storageState()`.
 * Copies all sessionStorage entries into localStorage with a prefix.
 */
export async function persistSessionStorage(page: Page): Promise<void> {
  await page.evaluate((prefix) => {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const val = sessionStorage.getItem(key);
        if (val !== null) localStorage.setItem(`${prefix}${key}`, val);
      }
    }
  }, E2E_SESSION_PREFIX);
}

/**
 * Call at the START of each test (in a fixture or beforeEach).
 * Restores prefixed localStorage entries back into sessionStorage, then removes the prefixed copies.
 */
export async function restoreSessionStorage(page: Page): Promise<void> {
  await page.evaluate((prefix) => {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const realKey = key.slice(prefix.length);
        const val = localStorage.getItem(key);
        if (val !== null) sessionStorage.setItem(realKey, val);
        toRemove.push(key);
      }
    }
    for (const key of toRemove) {
      localStorage.removeItem(key);
    }
  }, E2E_SESSION_PREFIX);
}
