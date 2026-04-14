'use client';

import { type Locale, localeLabels, locales } from '@roviq/i18n';
import { cn } from '@roviq/ui/lib/utils';
import { type FieldValues, type Path, useController, useFormContext } from 'react-hook-form';
import { FieldError, FieldLegend, FieldSet } from './field';
import { Input } from './input';

interface I18nInputProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  /** Reserved for future visual marker. Validation comes from the form resolver. */
  required?: boolean;
  placeholder?: string;
  className?: string;
  /**
   * Base test ID. If provided, each locale input gets `data-testid="${testId}-${locale}"`.
   * E.g. testId="staff-first-name" → "staff-first-name-en", "staff-first-name-hi".
   */
  testId?: string;
}

interface LocaleRowProps<T extends FieldValues> {
  parentName: Path<T>;
  parentLabel: string;
  locale: Locale;
  placeholder?: string;
  /**
   * Base test ID. If provided, the input gets `data-testid="${testId}-${locale}"`.
   * E.g. testId="staff-first-name" → "staff-first-name-en", "staff-first-name-hi".
   */
  testId?: string;
}

/**
 * One input row bound to `${parentName}.${locale}` via `useController`.
 * `useController` subscribes to the exact nested path so Zod resolver errors —
 * including those attached to the parent i18n object via `path: [defaultLocale]` —
 * propagate to `fieldState.error` and flip `aria-invalid` correctly.
 */
function LocaleRow<T extends FieldValues>({
  parentName,
  parentLabel,
  locale,
  placeholder,
  testId,
}: LocaleRowProps<T>) {
  const fieldPath = `${parentName}.${locale}` as Path<T>;
  const {
    field,
    fieldState: { error },
  } = useController<T>({ name: fieldPath });

  const invalid = Boolean(error);

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-xs text-muted-foreground">{locale.toUpperCase()}</span>
        <Input
          {...field}
          value={typeof field.value === 'string' ? field.value : ''}
          placeholder={placeholder ?? localeLabels[locale]}
          aria-label={`${parentLabel} (${localeLabels[locale]})`}
          aria-invalid={invalid}
          data-testid={testId ? `${testId}-${locale}` : undefined}
        />
      </div>
      {error?.message && <FieldError errors={[{ message: error.message }]} />}
    </div>
  );
}

/**
 * Multi-locale text input for i18n JSONB fields.
 * Renders one input per supported locale. Validation is delegated entirely to the
 * form's resolver (typically Zod via `i18nTextSchema`) — the component does not
 * register inline rules.
 *
 * Supports nested paths (e.g. `branding.displayName`) because `useController`
 * correctly subscribes to nested `FieldPath`s.
 *
 * Must be used inside a `<FormProvider>`.
 */
export function I18nInput<T extends FieldValues>({
  name,
  label,
  placeholder,
  className,
  testId,
}: I18nInputProps<T>) {
  // Touch context so a clear error is thrown outside FormProvider.
  useFormContext<T>();

  return (
    <FieldSet className={cn('space-y-1', className)}>
      <FieldLegend variant="label">{label}</FieldLegend>
      <div className="mt-1 space-y-2">
        {locales.map((locale) => (
          <LocaleRow<T>
            key={locale}
            parentName={name}
            parentLabel={label}
            locale={locale}
            placeholder={placeholder}
            testId={testId}
          />
        ))}
      </div>
    </FieldSet>
  );
}
