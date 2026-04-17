'use client';

import { type Locale, localeLabels, locales } from '@roviq/i18n';
import { FieldDescription, FieldError, FieldLegend, FieldSet } from '@roviq/ui/components/ui/field';
import { Input } from '@roviq/ui/components/ui/input';
import { fieldErrorMessages } from '@roviq/ui/form/errors';
import { cn } from '@roviq/ui/lib/utils';
import type { AnyFieldApi } from '@tanstack/react-form';
import type { ReactNode } from 'react';

// The TanStack `useAppForm()` return type (`AppFieldExtendedReactFormApi`)
// has many contravariant slots (`pushFieldValue`, `setFieldValue`, …) that
// collapse to `never` under `any` and reject structural matching against any
// duck-typed surface. The kit boundary therefore accepts `form: any` and
// trusts the consumer to pass a real `useAppForm` result. Field-level type
// safety is preserved inside the locale row via `field.state.value` checks.
// biome-ignore lint/suspicious/noExplicitAny: kit boundary is intentionally loose; runtime is constrained by useAppForm.
type AnyForm = any;

export interface I18nFieldProps {
  /** The form instance returned from `useAppForm()`. */
  form: AnyForm;
  /** Parent path in the form schema, e.g. `firstName` or `branding.displayName`. */
  name: string;
  label: ReactNode;
  description?: ReactNode;
  /**
   * Optional slot rendered inline after the legend text — typically a
   * `<FieldInfoPopover>` but any `ReactNode` is accepted.
   */
  info?: ReactNode;
  placeholder?: string;
  testId?: string;
  className?: string;
}

/**
 * Multi-locale text field for `i18nText()` JSONB columns. Renders one row
 * per supported locale (`en`, `hi`, …) and binds each row to
 * `${name}.${locale}` via `form.Field`.
 *
 * Pass the form instance explicitly (not registered as a kit fieldComponent)
 * so callers don't need to wrap in `<form.AppField>` just to reach it:
 *
 * ```tsx
 * <I18nField form={form} name="firstName" label={t('fields.firstName')} />
 * ```
 *
 * For nested paths (`branding.displayName`), `name` accepts the full dotted
 * path; the locale rows resolve to `branding.displayName.en`, etc.
 */
export function I18nField({
  form,
  name,
  label,
  description,
  info,
  placeholder,
  testId,
  className,
}: I18nFieldProps) {
  return (
    <FieldSet className={cn('space-y-1', className)}>
      <FieldLegend variant="label" className="flex items-center gap-2">
        {label}
        {info}
      </FieldLegend>
      <div className="mt-1 space-y-2">
        {locales.map((locale) => (
          <I18nFieldLocaleRow
            key={locale}
            form={form}
            parentName={name}
            parentLabel={typeof label === 'string' ? label : ''}
            locale={locale}
            placeholder={placeholder}
            testId={testId}
          />
        ))}
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
    </FieldSet>
  );
}

interface I18nFieldLocaleRowProps {
  form: AnyForm;
  parentName: string;
  parentLabel: string;
  locale: Locale;
  placeholder?: string;
  testId?: string;
}

function I18nFieldLocaleRow({
  form,
  parentName,
  parentLabel,
  locale,
  placeholder,
  testId,
}: I18nFieldLocaleRowProps) {
  return (
    // biome-ignore lint/suspicious/noExplicitAny: runtime-built nested path string can't be narrowed against the form's typed name union.
    <form.Field name={`${parentName}.${locale}` as any}>
      {(field: AnyFieldApi) => {
        const errors = fieldErrorMessages(field);
        const invalid = errors.length > 0;
        const value = typeof field.state.value === 'string' ? field.state.value : '';
        const ariaLabel = parentLabel
          ? `${parentLabel} (${localeLabels[locale]})`
          : localeLabels[locale];
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
                aria-invalid={invalid || undefined}
                data-testid={testId ? `${testId}-${locale}` : undefined}
              />
            </div>
            {invalid && <FieldError errors={errors} />}
          </div>
        );
      }}
    </form.Field>
  );
}
