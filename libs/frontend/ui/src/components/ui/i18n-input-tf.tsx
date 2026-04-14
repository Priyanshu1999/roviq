'use client';

import { type Locale, localeLabels, locales } from '@roviq/i18n';
import type { AnyFieldApi } from '@tanstack/react-form';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { FieldError, FieldLegend, FieldSet } from './field';
import { Input } from './input';

/**
 * Layout wrapper for a multi-locale text field bound to TanStack Form v1.
 *
 * Usage:
 *
 *   <I18nInputTF label={t('fields.firstName')}>
 *     <form.Field name="firstName.en">
 *       {(f) => <I18nInputTFLocaleField field={f} locale="en" placeholder="..." />}
 *     </form.Field>
 *     <form.Field name="firstName.hi">
 *       {(f) => <I18nInputTFLocaleField field={f} locale="hi" placeholder="..." />}
 *     </form.Field>
 *   </I18nInputTF>
 *
 * The companion `I18nInput` (react-hook-form) is kept for forms that have
 * not yet migrated; delete it once every consumer is on TanStack Form.
 *
 * This split layout + field helper avoids the 12-generic
 * `ReactFormExtendedApi` typing that would otherwise force every caller to
 * repeat `useForm`'s full type signature at the component boundary.
 */
interface I18nInputTFProps {
  label: string;
  className?: string;
  children: ReactNode;
}

export function I18nInputTF({ label, className, children }: I18nInputTFProps) {
  return (
    <FieldSet className={cn('space-y-1', className)}>
      <FieldLegend variant="label">{label}</FieldLegend>
      <div className="mt-1 space-y-2">{children}</div>
    </FieldSet>
  );
}

interface I18nInputTFLocaleFieldProps {
  field: AnyFieldApi;
  locale: Locale;
  placeholder?: string;
  /** Parent field label — combined with locale for unique accessible name (e.g. "First name (English)") */
  parentLabel?: string;
  /**
   * Base test ID. If provided, the input gets `data-testid="${testId}-${locale}"`.
   * E.g. testId="guardian-first-name" → "guardian-first-name-en", "guardian-first-name-hi".
   */
  testId?: string;
}

function fieldErrorMessages(field: AnyFieldApi): string[] {
  if (!field.state.meta.isTouched) return [];
  return field.state.meta.errors
    .map((err: unknown) => {
      if (err == null) return null;
      if (typeof err === 'string') return err;
      if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
        return err.message;
      }
      return null;
    })
    .filter((msg: string | null): msg is string => msg !== null && msg.length > 0);
}

export function I18nInputTFLocaleField({
  field,
  locale,
  placeholder,
  parentLabel,
  testId,
}: I18nInputTFLocaleFieldProps) {
  const messages = fieldErrorMessages(field);
  const invalid = messages.length > 0;
  const value = typeof field.state.value === 'string' ? field.state.value : '';
  const ariaLabel = parentLabel ? `${parentLabel} (${localeLabels[locale]})` : localeLabels[locale];
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-xs text-muted-foreground">{locale.toUpperCase()}</span>
        <Input
          id={field.name}
          name={field.name}
          value={value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={field.handleBlur}
          placeholder={placeholder ?? localeLabels[locale]}
          aria-label={ariaLabel}
          aria-invalid={invalid}
          data-testid={testId ? `${testId}-${locale}` : undefined}
        />
      </div>
      {invalid && <FieldError errors={messages.map((message) => ({ message }))} />}
    </div>
  );
}

/** Re-export for callers that want to loop over locales. */
export const i18nLocales = locales;
