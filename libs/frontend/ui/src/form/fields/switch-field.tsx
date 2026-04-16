'use client';

import type { ReactNode } from 'react';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '../../components/ui/field';
import { Switch } from '../../components/ui/switch';
import { fieldErrorMessages } from '../errors';
import { useFieldContext } from '../use-app-form';

export interface SwitchFieldProps {
  label: ReactNode;
  description?: ReactNode;
  testId?: string;
  disabled?: boolean;
}

export function SwitchField({ label, description, testId, disabled }: SwitchFieldProps) {
  const field = useFieldContext<boolean | undefined>();
  const errors = fieldErrorMessages(field);
  const invalid = errors.length > 0;
  const checked = field.state.value === true;
  return (
    <Field orientation="horizontal" data-invalid={invalid || undefined}>
      <Switch
        id={field.name}
        name={field.name}
        checked={checked}
        onCheckedChange={(next) => field.handleChange(next === true)}
        onBlur={field.handleBlur}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        data-testid={testId}
      />
      <FieldContent>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
        {invalid && <FieldError errors={errors} />}
      </FieldContent>
    </Field>
  );
}
