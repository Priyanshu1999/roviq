import '@testing-library/jest-dom/vitest';
import { zodResolver } from '@hookform/resolvers/zod';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// Avoid pulling in next-intl/middleware from @roviq/i18n barrel during tests.
vi.mock('@roviq/i18n', () => ({
  locales: ['en', 'hi'] as const,
  localeLabels: { en: 'English', hi: 'हिन्दी' },
  defaultLocale: 'en' as const,
}));

import { I18nInput } from '../i18n-input';

// Local i18n shape mirroring `i18nTextSchema` behaviour:
// - `en` must be a non-empty string
// - `hi` is optional, but when provided, limited to 500 chars
// Errors are attached to the sub-locale path so per-field subscriptions pick them up.
const localI18nSchema = z
  .object({
    en: z.string().max(500),
    hi: z.string().max(500).optional().default(''),
  })
  .refine((obj) => obj.en.trim().length > 0, {
    path: ['en'],
    message: 'Default locale (en) translation is required',
  });

function makeFlatSchema() {
  return z.object({ name: localI18nSchema });
}

function makeNestedSchema() {
  return z.object({ branding: z.object({ displayName: localI18nSchema }) });
}

function FlatWrapper({ children }: { children: ReactNode }) {
  const methods = useForm({
    defaultValues: { name: { en: '', hi: '' } },
    resolver: zodResolver(makeFlatSchema()),
    mode: 'onSubmit',
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(() => {})}>
        {children}
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}

function NestedWrapper({ children }: { children: ReactNode }) {
  const methods = useForm({
    defaultValues: { branding: { displayName: { en: '', hi: '' } } },
    resolver: zodResolver(makeNestedSchema()),
    mode: 'onSubmit',
  });
  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(() => {})}>
        {children}
        <button type="submit">Submit</button>
      </form>
    </FormProvider>
  );
}

// Simple wrapper without resolver, for basic rendering tests.
function PlainWrapper({ children }: { children: ReactNode }) {
  const methods = useForm({ defaultValues: { name: { en: '', hi: '' } } });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe('I18nInput', () => {
  it('renders one input per supported locale', () => {
    render(
      <PlainWrapper>
        <I18nInput name="name" label="Institute Name" />
      </PlainWrapper>,
    );
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('HI')).toBeInTheDocument();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('renders the legend label', () => {
    render(
      <PlainWrapper>
        <I18nInput name="name" label="Institute Name" />
      </PlainWrapper>,
    );
    expect(screen.getByText('Institute Name')).toBeInTheDocument();
  });

  it('uses default placeholder per locale label when not provided', () => {
    render(
      <PlainWrapper>
        <I18nInput name="name" label="Institute Name" />
      </PlainWrapper>,
    );
    expect(screen.getByPlaceholderText('English')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('हिन्दी')).toBeInTheDocument();
  });

  it('uses custom placeholder when supplied', () => {
    render(
      <PlainWrapper>
        <I18nInput name="name" label="Institute Name" placeholder="Type here" />
      </PlainWrapper>,
    );
    expect(screen.getAllByPlaceholderText('Type here')).toHaveLength(2);
  });

  it('accepts user input on each locale field', async () => {
    render(
      <PlainWrapper>
        <I18nInput name="name" label="Institute Name" />
      </PlainWrapper>,
    );
    const [enInput, hiInput] = screen.getAllByRole('textbox');
    await userEvent.type(enInput, 'Roviq School');
    expect(enInput).toHaveValue('Roviq School');
    await userEvent.type(hiInput, 'रोविक्यू');
    expect(hiInput).toHaveValue('रोविक्यू');
  });

  it('has aria-invalid=false when there are no errors', () => {
    render(
      <FlatWrapper>
        <I18nInput name="name" label="Institute Name" />
      </FlatWrapper>,
    );
    const [enInput, hiInput] = screen.getAllByRole('textbox');
    expect(enInput).toHaveAttribute('aria-invalid', 'false');
    expect(hiInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('surfaces Zod resolver error on the en input when default locale is blank', async () => {
    render(
      <FlatWrapper>
        <I18nInput name="name" label="Institute Name" />
      </FlatWrapper>,
    );

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(
      await screen.findByText(/Default locale \(en\) translation is required/),
    ).toBeInTheDocument();

    const [enInput, hiInput] = screen.getAllByRole('textbox');
    expect(enInput).toHaveAttribute('aria-invalid', 'true');
    expect(hiInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('surfaces a Zod error scoped to hi on the hi input', async () => {
    // Build a schema that attaches an error specifically to `hi`.
    const hiSchema = z.object({
      name: z
        .object({
          en: z.string().min(1),
          hi: z.string().max(500).optional().default(''),
        })
        .refine((obj) => (obj.hi ?? '').length <= 3, {
          path: ['hi'],
          message: 'Hindi translation too long',
        }),
    });

    function HiWrapper({ children }: { children: ReactNode }) {
      const methods = useForm({
        defaultValues: { name: { en: 'Roviq', hi: 'रोविक्यू इंस्टिट्यूट' } },
        resolver: zodResolver(hiSchema),
        mode: 'onSubmit',
      });
      return (
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(() => {})}>
            {children}
            <button type="submit">Submit</button>
          </form>
        </FormProvider>
      );
    }

    render(
      <HiWrapper>
        <I18nInput name="name" label="Institute Name" />
      </HiWrapper>,
    );

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText('Hindi translation too long')).toBeInTheDocument();
    const [enInput, hiInput] = screen.getAllByRole('textbox');
    expect(hiInput).toHaveAttribute('aria-invalid', 'true');
    expect(enInput).toHaveAttribute('aria-invalid', 'false');
  });

  it('works for nested paths (branding.displayName)', async () => {
    render(
      <NestedWrapper>
        <I18nInput name="branding.displayName" label="Display Name" />
      </NestedWrapper>,
    );

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(
      await screen.findByText(/Default locale \(en\) translation is required/),
    ).toBeInTheDocument();
    const [enInput] = screen.getAllByRole('textbox');
    expect(enInput).toHaveAttribute('aria-invalid', 'true');
  });
});
