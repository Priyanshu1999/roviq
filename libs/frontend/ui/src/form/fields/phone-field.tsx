'use client';

import { Field, FieldDescription, FieldError } from '@roviq/ui/components/ui/field';
import { Input } from '@roviq/ui/components/ui/input';
import { fieldErrorMessages } from '@roviq/ui/form/errors';
import { FieldLabelWithInfo } from '@roviq/ui/form/fields/field-label-with-info';
import { useFieldContext } from '@roviq/ui/form/use-app-form';
import type { ReactNode } from 'react';

export interface PhoneFieldProps {
  label: ReactNode;
  description?: ReactNode;
  /**
   * Optional slot rendered inline after the label text — typically a
   * `<FieldInfoPopover>` but any `ReactNode` is accepted.
   */
  info?: ReactNode;
  placeholder?: string;
  testId?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Indian mobile number input with `+91` prefix label per [GZUFW]. Stores the
 * raw 10-digit string; the schema (`phoneSchema` from `@roviq/i18n`) validates
 * `[6-9]\d{9}`. The `+91` is rendered as a non-editable visual prefix; on
 * submit, callers should prepend it to form the E.164 wire value.
 */
export function PhoneField({
  label,
  description,
  info,
  placeholder,
  testId,
  disabled,
  required,
}: PhoneFieldProps) {
  const field = useFieldContext<string | undefined>();
  const errors = fieldErrorMessages(field);
  const invalid = errors.length > 0;
  const value = typeof field.state.value === 'string' ? field.state.value : '';
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelWithInfo htmlFor={field.name} info={info}>
        {label}
      </FieldLabelWithInfo>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground" aria-hidden="true">
          +91
        </span>
        <Input
          id={field.name}
          name={field.name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={10}
          value={value}
          onChange={(e) => {
            // Strip non-digits at the source so partial submissions are clean.
            const digits = e.target.value.replace(/\D+/g, '').slice(0, 10);
            field.handleChange(digits);
          }}
          onBlur={field.handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={invalid || undefined}
          data-testid={testId}
        />
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  );
}
