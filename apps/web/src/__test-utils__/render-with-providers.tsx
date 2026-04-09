import '@testing-library/jest-dom/vitest';
import { MockedProvider, type MockedProviderProps } from '@apollo/client/testing/react';
import { createMongoAbility, type RawRuleOf } from '@casl/ability';
import type { AppAbility } from '@roviq/common-types';
import { AbilityContext } from '@roviq/ui';
import { type RenderResult, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

/**
 * Shared test wrapper for apps/web component tests.
 *
 * Provides:
 * - NextIntlClientProvider with locale=en + a partial messages object loaded
 *   per-test (so each spec only needs to import the namespaces it touches).
 * - AbilityContext.Provider with a permissive (or supplied) ability so any
 *   `<Can>` / `useAbility()` checks pass without wiring CASL.
 * - MockedProvider for Apollo. Defaults to an empty mocks array — most form
 *   specs mock the `use-*.ts` hook module directly via vi.mock(), so the
 *   provider just needs to exist for any nested Apollo consumers.
 *
 * Tests that need real Apollo MockedProvider matching can pass `apolloMocks`.
 */
export interface RenderWithProvidersOptions {
  messages?: Record<string, unknown>;
  locale?: 'en' | 'hi';
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
    messages = {},
    locale = 'en',
    abilityRules = PERMISSIVE_RULES,
    apolloMocks = [],
  } = options;

  const ability = createMongoAbility<AppAbility>(abilityRules);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MockedProvider mocks={apolloMocks} addTypename={false}>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Kolkata">
          <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>
        </NextIntlClientProvider>
      </MockedProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
