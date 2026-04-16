'use client';

import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { fieldErrorMessages } from '../errors';
import { useFieldContext } from '../use-app-form';

export interface TextFieldProps {
  label: ReactNode;
  description?: ReactNode;
  placeholder?: string;
  type?: 'text' | 'email' | 'url' | 'tel' | 'password';
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'search';
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
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
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
