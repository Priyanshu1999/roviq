'use client';

import { useFormatNumber } from '@roviq/i18n';
import type { ReactNode } from 'react';
import { Field, FieldDescription, FieldError, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { fieldErrorMessages } from '../errors';
import { useFieldContext } from '../use-app-form';

export interface MoneyFieldProps {
  label: ReactNode;
  description?: ReactNode;
  placeholder?: string;
  /** Inclusive lower bound in rupees. Defaults to 0 (no negatives per [YPQTF]). */
  min?: number;
  /** Inclusive upper bound in rupees. */
  max?: number;
  testId?: string;
  disabled?: boolean;
  required?: boolean;
  /**
   * When true, render an Indian-formatted preview (₹1,00,000) as the field
   * description. Pairs with [HVJED]. Defaults to true.
   */
  showFormattedPreview?: boolean;
  /** ISO currency code. Defaults to INR. */
  currency?: string;
}

/**
 * Currency input that stores `number | undefined` in **rupees**. Conversion
 * to paise (BIGINT wire format per [HVJED]) happens in the consumer's
 * `onSubmit` handler — keeping it out of the field component avoids precision
 * surprises if a caller wants different rounding semantics.
 */
export function MoneyField({
  label,
  description,
  placeholder,
  min = 0,
  max,
  testId,
  disabled,
  required,
  showFormattedPreview = true,
  currency = 'INR',
}: MoneyFieldProps) {
  const field = useFieldContext<number | undefined>();
  const formatter = useFormatNumber();
  const errors = fieldErrorMessages(field);
  const invalid = errors.length > 0;
  const raw = field.state.value;
  const value = typeof raw === 'number' && !Number.isNaN(raw) ? String(raw) : '';
  const preview =
    showFormattedPreview && typeof raw === 'number' && !Number.isNaN(raw) && raw >= 0
      ? formatter.currency(raw, currency)
      : null;
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground" aria-hidden="true">
          ₹
        </span>
        <Input
          id={field.name}
          name={field.name}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={min}
          max={max}
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
          disabled={disabled}
          required={required}
          aria-invalid={invalid || undefined}
          data-testid={testId}
        />
      </div>
      {(description || preview) && (
        <FieldDescription>
          {description}
          {description && preview ? ' · ' : null}
          {preview}
        </FieldDescription>
      )}
      {invalid && <FieldError errors={errors} />}
    </Field>
  );
}
