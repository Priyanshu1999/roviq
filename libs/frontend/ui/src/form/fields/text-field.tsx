'use client';

import { Field, FieldDescription, FieldError } from '@roviq/ui/components/ui/field';
import { Input } from '@roviq/ui/components/ui/input';
import { fieldErrorMessages } from '@roviq/ui/form/errors';
import { FieldLabelWithInfo } from '@roviq/ui/form/fields/field-label-with-info';
import { useFieldContext } from '@roviq/ui/form/use-app-form';
import type { ReactNode } from 'react';

export interface TextFieldProps {
  label: ReactNode;
  description?: ReactNode;
  /**
   * Optional slot rendered inline after the label text — typically a
   * `<FieldInfoPopover>` but any `ReactNode` is accepted.
   */
  info?: ReactNode;
  placeholder?: string;
  type?: 'text' | 'email' | 'url' | 'tel' | 'password';
  autoComplete?: string;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  testId?: string;
  /** Test ID applied to the error element when validation fails. */
  errorTestId?: string;
  disabled?: boolean;
  required?: boolean;
  /** Maximum character length forwarded to the underlying input. */
  maxLength?: number;
}

export function TextField({
  label,
  description,
  info,
  placeholder,
  type = 'text',
  autoComplete,
  inputMode,
  testId,
  errorTestId,
  disabled,
  required,
  maxLength,
}: TextFieldProps) {
  const field = useFieldContext<string | undefined>();
  const errors = fieldErrorMessages(field);
  const invalid = errors.length > 0;
  const value = typeof field.state.value === 'string' ? field.state.value : '';
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabelWithInfo htmlFor={field.name} info={info}>
        {label}
      </FieldLabelWithInfo>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        value={value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        data-testid={testId}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError data-testid={errorTestId} errors={errors} />}
    </Field>
  );
}
