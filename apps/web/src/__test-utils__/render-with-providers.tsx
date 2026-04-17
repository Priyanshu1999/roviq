import '@testing-library/jest-dom/vitest';
import { MockedProvider, type MockedProviderProps } from '@apollo/client/testing/react';
import { createMongoAbility, type RawRuleOf } from '@casl/ability';
import type { AppAbility } from '@roviq/common-types';
import type { Locale } from '@roviq/i18n';
import { AbilityContext } from '@roviq/ui';
import { type RenderResult, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import { getLocaleMessages } from '../i18n/messages';

/**
 * Shared test wrapper for apps/web component tests.
 *
 * Provides:
 * - NextIntlClientProvider with the full locale message bundle by default
 *   (same loader as production). Per-test `messages` overrides are merged on
 *   top — pass them only to inject custom strings for a specific test, never
 *   to opt in to a namespace.
 * - `onError` throws on any MISSING_MESSAGE / MISSING_FORMAT so tests fail
 *   loudly instead of writing warnings to stderr.
 * - AbilityContext.Provider with a permissive (or supplied) ability so any
 *   `<Can>` / `useAbility()` checks pass without wiring CASL.
 * - MockedProvider for Apollo. Defaults to an empty mocks array — most form
 *   specs mock the `use-*.ts` hook module directly via vi.mock(), so the
 *   provider just needs to exist for any nested Apollo consumers.
 */
export interface RenderWithProvidersOptions {
  /** Extra messages merged on top of the full default bundle for this locale. */
  messages?: Record<string, unknown>;
  locale?: Locale;
  abilityRules?: RawRuleOf<AppAbility>[];
  /** Apollo MockedProvider mocks. Defaults to empty array. */
  apolloMocks?: MockedProviderProps['mocks'];
}

const PERMISSIVE_RULES: RawRuleOf<AppAbility>[] = [{ action: 'manage', subject: 'all' }];

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult {
  const {
    messages: overrideMessages,
    locale = 'en',
    abilityRules = PERMISSIVE_RULES,
    apolloMocks = [],
  } = options;

  const messages = { ...getLocaleMessages(locale), ...(overrideMessages ?? {}) };

  const ability = createMongoAbility<AppAbility>(abilityRules);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MockedProvider mocks={apolloMocks}>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          timeZone="Asia/Kolkata"
          onError={(error) => {
            // Throw on any i18n error so tests fail loudly instead of writing
            // to stderr. Covers MISSING_MESSAGE, INSUFFICIENT_PATH,
            // MISSING_FORMAT, INVALID_MESSAGE, etc.
            throw error;
          }}
        >
          <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
        </NextIntlClientProvider>
      </MockedProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
