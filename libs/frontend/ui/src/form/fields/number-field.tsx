'use client';

import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { fieldErrorMessages } from '../errors';
import { useFieldContext } from '../use-app-form';

export interface NumberFieldProps {
  label: ReactNode;
  description?: ReactNode;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  testId?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Numeric input that emits `number | undefined`. Empty input → `undefined`
 * (mirrors the `optionalInt` Zod helper). Use for plain integers and decimals;
 * for currency, use `MoneyField` instead.
 */
export function NumberField({
  label,
  description,
  placeholder,
  min,
  max,
  step,
  testId,
  disabled,
  required,
}: NumberFieldProps) {
  const field = useFieldContext<number | undefined>();
  const errors = fieldErrorMessages(field);
  const invalid = errors.length > 0;
  const raw = field.state.value;
  const value = typeof raw === 'number' && !Number.isNaN(raw) ? String(raw) : '';
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (next === '') {
            field.handleChange(undefined);
            return;
          }
          const parsed = Number(next);
          field.handleChange(Number.isNaN(parsed) ? undefined : parsed);
        }}
        onBlur={field.handleBlur}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        required={required}
        aria-invalid={invalid || undefined}
        data-testid={testId}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  );
}
