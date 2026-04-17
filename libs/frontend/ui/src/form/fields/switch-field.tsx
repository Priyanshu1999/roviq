'use client';

import { Field, FieldContent, FieldDescription, FieldError } from '@roviq/ui/components/ui/field';
import { Switch } from '@roviq/ui/components/ui/switch';
import { fieldErrorMessages } from '@roviq/ui/form/errors';
import { FieldLabelWithInfo } from '@roviq/ui/form/fields/field-label-with-info';
import { useFieldContext } from '@roviq/ui/form/use-app-form';
import type { ReactNode } from 'react';

export interface SwitchFieldProps {
  label: ReactNode;
  description?: ReactNode;
  /**
   * Optional slot rendered inline after the label text — typically a
   * `<FieldInfoPopover>` but any `ReactNode` is accepted.
   */
  info?: ReactNode;
  testId?: string;
  disabled?: boolean;
}

export function SwitchField({ label, description, info, testId, disabled }: SwitchFieldProps) {
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
        <FieldLabelWithInfo htmlFor={field.name} info={info}>
          {label}
        </FieldLabelWithInfo>
        {description && <FieldDescription>{description}</FieldDescription>}
        {invalid && <FieldError errors={errors} />}
      </FieldContent>
    </Field>
  );
}
