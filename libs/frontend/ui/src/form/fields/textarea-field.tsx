'use client';

import { Field, FieldDescription, FieldError } from '@roviq/ui/components/ui/field';
import { Textarea } from '@roviq/ui/components/ui/textarea';
import { fieldErrorMessages } from '@roviq/ui/form/errors';
import { FieldLabelWithInfo } from '@roviq/ui/form/fields/field-label-with-info';
import { useFieldContext } from '@roviq/ui/form/use-app-form';
import type { ReactNode } from 'react';

export interface TextareaFieldProps {
  label: ReactNode;
  description?: ReactNode;
  /**
   * Optional slot rendered inline after the label text — typically a
   * `<FieldInfoPopover>` but any `ReactNode` is accepted.
   */
  info?: ReactNode;
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
  info,
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
      <FieldLabelWithInfo htmlFor={field.name} info={info}>
        {label}
      </FieldLabelWithInfo>
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
