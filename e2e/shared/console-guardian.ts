/**
 * Console Guardian — Playwright fixture that passively monitors browser console,
 * network, and accessibility throughout all E2E tests and fails if errors are detected.
 *
 * Catches:
 * - Missing i18n keys (next-intl logs `IntlError: MISSING_MESSAGE: Could not resolve 'key'`)
 * - Unhandled React errors, hydration mismatches
 * - GraphQL responses with `errors` array (Apollo silently returns { data: null, errors: [...] })
 * - Any console.error() call
 * - Uncaught exceptions and unhandled promise rejections
 * - WCAG 2.x accessibility violations (via @axe-core/playwright)
 *
 * Usage:
 *   import { test, expect } from '../../shared/console-guardian';
 *   // Every test automatically gets monitoring. Zero additional code needed.
 *
 * Opt out per-test:
 *   test.use({ failOnConsoleErrors: false });
 *
 * Enable accessibility checks (default off — enable per-project in playwright.config.ts):
 *   test.use({ checkAccessibility: true });
 *
 * Location: e2e/shared/console-guardian.ts
 */

import AxeBuilder from '@axe-core/playwright';
import { test as base, type ConsoleMessage, expect } from '@playwright/test';
import { E2E_SESSION_PREFIX } from './auth-helpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConsoleEntry {
  type: string;
  text: string;
  url: string;
  location: { url: string; lineNumber: number; columnNumber: number } | null;
}

interface GraphQLError {
  operationName: string | null;
  errors: Array<{ message: string; extensions?: { code?: string } }>;
}

interface A11yViolation {
  id: string;
  impact: string | undefined;
  description: string;
  nodes: number;
  helpUrl: string;
}

interface ConsoleGuardianFixture {
  /** Set to false to disable console/graphql error assertions for a specific test. */
  failOnConsoleErrors: boolean;
  /**
   * Enable WCAG accessibility scanning on the final page state after each test.
   * Default: false. Enable per-project in playwright.config.ts:
   *   use: { checkAccessibility: true }
   */
  checkAccessibility: boolean;
  /** All collected console errors. Available in test body if you need to inspect. */
  consoleErrors: ConsoleEntry[];
  /** All collected console warnings. Not auto-failed, but available for assertions. */
  consoleWarnings: ConsoleEntry[];
  /** Missing i18n keys extracted from console errors. */
  missingI18nKeys: string[];
  /** GraphQL responses that contained errors. */
  graphqlErrors: GraphQLError[];
  /**
   * Pre-configured AxeBuilder for manual accessibility scans within a test.
   * Uses consistent WCAG tags + excludes. Call `(await makeAxeBuilder()).analyze()`.
   */
  makeAxeBuilder: () => AxeBuilder;
}

// ─── Ignored patterns ────────────────────────────────────────────────────────
// Add patterns here for console errors that are expected/benign.

const IGNORED_ERROR_PATTERNS: RegExp[] = [
  // Next.js hot reload noise in dev
  /Fast Refresh/i,
  /\[HMR\]/,
  // Chromium DevTools noise
  /Download the React DevTools/,
  // Favicon 404 (common in local dev)
  /favicon\.ico.*404/,
  // WebSocket reconnection attempts (expected during test setup)
  /WebSocket connection to .* failed/,
  // Novu notification inbox — not running in e2e environment
  /ERR_CONNECTION_REFUSED/,
];

// GraphQL error codes that are expected and should not fail the test.
// Add codes here only if they represent intentionally-tested error paths.
const IGNORED_GRAPHQL_CODES = new Set<string>([]);

// WCAG rule tags to check — matches Accessibility Insights for Web behavior
const AXE_WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

// ─── i18n detection ──────────────────────────────────────────────────────────
// next-intl default onError logs:
//   "IntlError: MISSING_MESSAGE: Could not resolve `key` in messages for locale `en`"

const I18N_MISSING_KEY_PATTERN = /IntlError: MISSING_MESSAGE: Could not resolve [`'](.+?)[`']/;

const I18N_FALLBACK_PATTERN = /is not yet translated$/;

// ─── Fixture ─────────────────────────────────────────────────────────────────

export const test = base.extend<ConsoleGuardianFixture>({
  failOnConsoleErrors: [true, { option: true }],
  // WCAG a11y scan runs automatically after each test. To disable:
  //   Per-project: use: { checkAccessibility: false } in playwright.config.ts
  //   Per-test:    test.use({ checkAccessibility: false });
  checkAccessibility: [true, { option: true }],
  consoleErrors: [[], { option: true }],
  consoleWarnings: [[], { option: true }],
  missingI18nKeys: [[], { option: true }],
  graphqlErrors: [[], { option: true }],

  makeAxeBuilder: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }).withTags([...AXE_WCAG_TAGS]));
  },

  page: async ({ page, failOnConsoleErrors, checkAccessibility }, use, testInfo) => {
    // Restore sessionStorage tokens from localStorage (persisted by auth setup).
    // addInitScript runs before any page script on every navigation.
    await page.addInitScript((prefix) => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) {
          const realKey = key.slice(prefix.length);
          const val = localStorage.getItem(key);
          if (val !== null) sessionStorage.setItem(realKey, val);
        }
      }
    }, E2E_SESSION_PREFIX);

    const errors: ConsoleEntry[] = [];
    const warnings: ConsoleEntry[] = [];
    const missingKeys: string[] = [];
    const pageErrors: string[] = [];
    const gqlErrors: GraphQLError[] = [];

    // Promises for async response body parsing — resolved in teardown
    const pendingResponseChecks: Promise<void>[] = [];

    // ── Console message listener ──
    const onConsole = (msg: ConsoleMessage) => {
      const text = msg.text();
      const entry: ConsoleEntry = {
        type: msg.type(),
        text,
        url: msg.location().url,
        location: msg.location(),
      };

      if (msg.type() === 'error') {
        if (IGNORED_ERROR_PATTERNS.some((p) => p.test(text))) return;

        errors.push(entry);

        const i18nMatch = text.match(I18N_MISSING_KEY_PATTERN);
        if (i18nMatch) {
          missingKeys.push(i18nMatch[1]);
        }
      }

      if (msg.type() === 'warning') {
        warnings.push(entry);

        if (I18N_FALLBACK_PATTERN.test(text)) {
          const key = text.replace(' is not yet translated', '');
          missingKeys.push(key);
        }
      }
    };

    // ── Uncaught exception listener ──
    const onPageError = (error: Error) => {
      pageErrors.push(`${error.name}: ${error.message}`);
      errors.push({
        type: 'pageerror',
        text: `Uncaught: ${error.name}: ${error.message}`,
        url: '',
        location: null,
      });
    };

    // ── GraphQL response listener ──
    // page.on('response') callback must be sync — push a promise and await later.
    const onResponse = (response: import('@playwright/test').Response) => {
      const url = response.url();
      if (!url.includes('/api/graphql')) return;
      // Only check HTTP 200 responses — 4xx/5xx already fail visibly
      if (response.status() !== 200) return;

      const check = response
        .json()
        .then((body: { errors?: Array<{ message: string; extensions?: { code?: string } }> }) => {
          if (!body.errors || body.errors.length === 0) return;

          // Filter out ignored error codes
          const realErrors = body.errors.filter(
            (e) => !IGNORED_GRAPHQL_CODES.has(e.extensions?.code ?? ''),
          );
          if (realErrors.length === 0) return;

          // Try to extract operationName from the request body
          let operationName: string | null = null;
          try {
            const reqBody = response.request().postDataJSON();
            operationName = reqBody?.operationName ?? null;
          } catch {
            // postDataJSON() can throw if body is not JSON
          }

          gqlErrors.push({ operationName, errors: realErrors });
        })
        .catch(() => {
          // response.json() throws if body is not JSON (e.g. WebSocket upgrade) — ignore
        });

      pendingResponseChecks.push(check);
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('response', onResponse);

    // ── Run the test ──
    await use(page);

    // ── Post-test teardown ──
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('response', onResponse);

    // Wait for all pending GraphQL response checks to complete
    await Promise.allSettled(pendingResponseChecks);

    // ── Build failure report ──
    const failures: string[] = [];

    if (missingKeys.length > 0) {
      const unique = [...new Set(missingKeys)];
      failures.push(
        `Missing i18n keys (${unique.length}):\n${unique.map((k) => `  - ${k}`).join('\n')}`,
      );
    }

    if (gqlErrors.length > 0) {
      failures.push(
        `GraphQL errors (${gqlErrors.length}):\n${gqlErrors
          .map((e) => {
            const op = e.operationName ?? 'unknown';
            const msgs = e.errors.map(
              (err) => `${err.message} [${err.extensions?.code ?? 'NO_CODE'}]`,
            );
            return `  - ${op}: ${msgs.join('; ')}`;
          })
          .join('\n')}`,
      );
    }

    const nonI18nErrors = errors.filter((e) => !I18N_MISSING_KEY_PATTERN.test(e.text));
    if (nonI18nErrors.length > 0) {
      failures.push(
        `Console errors (${nonI18nErrors.length}):\n${nonI18nErrors
          .map(
            (e) =>
              `  - [${e.type}] ${e.text.substring(0, 200)}${e.text.length > 200 ? '...' : ''}` +
              (e.location ? ` (${e.location.url}:${e.location.lineNumber})` : ''),
          )
          .join('\n')}`,
      );
    }

    if (pageErrors.length > 0) {
      failures.push(
        `Uncaught exceptions (${pageErrors.length}):\n${pageErrors.map((e) => `  - ${e}`).join('\n')}`,
      );
    }

    // ── Accessibility scan (opt-in) ──
    if (checkAccessibility) {
      try {
        const a11yResults = await new AxeBuilder({ page })
          .withTags([...AXE_WCAG_TAGS])
          // Exclude third-party widgets whose DOM we don't control
          .exclude('[data-novu-inbox]')
          .analyze();

        if (a11yResults.violations.length > 0) {
          const a11yViolations: A11yViolation[] = a11yResults.violations.map((v) => ({
            id: v.id,
            impact: v.impact ?? undefined,
            description: v.description,
            nodes: v.nodes.length,
            helpUrl: v.helpUrl,
          }));

          failures.push(
            `Accessibility violations (${a11yViolations.length}):\n${a11yViolations
              .map(
                (v) =>
                  `  - [${v.impact ?? '?'}] ${v.id}: ${v.description} (${v.nodes} element${v.nodes > 1 ? 's' : ''})` +
                  `\n    ${v.helpUrl}`,
              )
              .join('\n')}`,
          );
        }
      } catch {
        // axe can fail if page navigated away or closed — don't crash the teardown
      }
    }

    if (failures.length > 0) {
      // Attach as test annotation so it shows in HTML report regardless of opt-out
      testInfo.annotations.push({
        type: 'console-guardian',
        description: failures.join('\n\n'),
      });

      if (failOnConsoleErrors) {
        expect(
          failures.length,
          `Console Guardian detected errors:\n\n${failures.join('\n\n')}`,
        ).toBe(0);
      }
    }
  },
});

export { expect };
