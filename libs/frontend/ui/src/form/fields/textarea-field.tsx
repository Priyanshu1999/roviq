'use client';

import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field';
import { Textarea } from '../../components/ui/textarea';
import { fieldErrorMessages } from '../errors';
import { useFieldContext } from '../use-app-form';

export interface TextareaFieldProps {
  label: ReactNode;
  description?: ReactNode;
  placeholder?: string;
  rows?: number;
  testId?: string;
  errorTestId?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
}

export function TextareaField({
  label,
  description,
  placeholder,
  rows = 4,
  testId,
  errorTestId,
  disabled,
  required,
  maxLength,
}: TextareaFieldProps) {
  const field = useFieldContext<string | undefined>();
  const errors = fieldErrorMessages(field);
  const invalid = errors.length > 0;
  const value = typeof field.state.value === 'string' ? field.state.value : '';
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Textarea
        id={field.name}
        name={field.name}
        value={value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        placeholder={placeholder}
        rows={rows}
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
