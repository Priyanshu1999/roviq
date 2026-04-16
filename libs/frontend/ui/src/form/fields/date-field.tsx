'use client';

import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { fieldErrorMessages } from '../errors';
import { useFieldContext } from '../use-app-form';

export interface DateFieldProps {
  label: ReactNode;
  description?: ReactNode;
  testId?: string;
  disabled?: boolean;
  required?: boolean;
  /** ISO date `YYYY-MM-DD`. Forwarded to `<input type="date">` min attr. */
  min?: string;
  /** ISO date `YYYY-MM-DD`. Forwarded to `<input type="date">` max attr. */
  max?: string;
}

/**
 * `<input type="date">` field. Emits `string` in `YYYY-MM-DD` format (the
 * native wire format). Display formatting (DD/MM/YYYY for IN locale) lives
 * downstream in `useFormatDate()` for read-only views.
 *
 * Empty input emits `''` (NOT `undefined`) — pair with `emptyStringToUndefined`
 * in your Zod schema for optional date fields.
 */
export function DateField({
  label,
  description,
  testId,
  disabled,
  required,
  min,
  max,
}: DateFieldProps) {
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
        type="date"
        value={value}
        onChange={(e) => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
        disabled={disabled}
        required={required}
        min={min}
        max={max}
        aria-invalid={invalid || undefined}
        data-testid={testId}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  );
}
