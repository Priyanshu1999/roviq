'use client';

import { Field, FieldDescription, FieldError } from '@roviq/ui/components/ui/field';
import { Input } from '@roviq/ui/components/ui/input';
import { fieldErrorMessages } from '@roviq/ui/form/errors';
import { FieldLabelWithInfo } from '@roviq/ui/form/fields/field-label-with-info';
import { useFieldContext } from '@roviq/ui/form/use-app-form';
import type { ReactNode } from 'react';

export interface NumberFieldProps {
  label: ReactNode;
  description?: ReactNode;
  /**
   * Optional slot rendered inline after the label text — typically a
   * `<FieldInfoPopover>` but any `ReactNode` is accepted.
   */
  info?: ReactNode;
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
  info,
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
      <FieldLabelWithInfo htmlFor={field.name} info={info}>
        {label}
      </FieldLabelWithInfo>
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
