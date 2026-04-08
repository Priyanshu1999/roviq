import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

// Avoid pulling in next-intl/middleware from @roviq/i18n barrel during tests.
vi.mock('@roviq/i18n', () => ({
  locales: ['en', 'hi'] as const,
  localeLabels: { en: 'English', hi: 'हिन्दी' },
}));

import { I18nInput } from '../i18n-input';

function Wrapper({ children }: { children: ReactNode }) {
  const methods = useForm({ defaultValues: { name: { en: '', hi: '' } } });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('I18nInput', () => {
  it('renders one input per supported locale', () => {
    render(
      <Wrapper>
        <I18nInput name="name" label="Institute Name" />
      </Wrapper>,
    );
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('HI')).toBeInTheDocument();
    // Two text inputs (one per locale)
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('renders the legend label', () => {
    render(
      <Wrapper>
        <I18nInput name="name" label="Institute Name" />
      </Wrapper>,
    );
    expect(screen.getByText('Institute Name')).toBeInTheDocument();
  });

  it('uses default placeholder per locale label when not provided', () => {
    render(
      <Wrapper>
        <I18nInput name="name" label="Institute Name" />
      </Wrapper>,
    );
    // localeLabels.en = 'English', localeLabels.hi = 'हिन्दी'
    expect(screen.getByPlaceholderText('English')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('हिन्दी')).toBeInTheDocument();
  });

  it('uses custom placeholder when supplied', () => {
    render(
      <Wrapper>
        <I18nInput name="name" label="Institute Name" placeholder="Type here" />
      </Wrapper>,
    );
    expect(screen.getAllByPlaceholderText('Type here')).toHaveLength(2);
  });

  it('accepts user input on each locale field', async () => {
    render(
      <Wrapper>
        <I18nInput name="name" label="Institute Name" />
      </Wrapper>,
    );
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'Roviq School');
    expect(inputs[0]).toHaveValue('Roviq School');
  });
});
