'use client';

import { Button, Field, FieldError, FieldLabel, fieldErrorMessages, Input } from '@roviq/ui';
import type { AnyFieldApi } from '@tanstack/react-form';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

// biome-ignore lint/suspicious/noExplicitAny: kit boundary is intentionally loose; runtime is constrained by useAppForm.
type AnyForm = any;

export interface ShiftsBuilderProps {
  form: AnyForm;
}

export function ShiftsBuilder({ form }: ShiftsBuilderProps) {
  const t = useTranslations('instituteSettings.config');

  return (
    <form.Field name="shifts" mode="array">
      {(arrayField: AnyFieldApi) => (
        <div className="space-y-3">
          {(arrayField.state.value as ReadonlyArray<unknown>).map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: array order is the only stable identity for these rows.
              key={index}
              className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-lg border p-3"
            >
              <form.AppField name={`shifts[${index}].name`}>
                {(field: AnyFieldApi) => {
                  const errors = fieldErrorMessages(field);
                  const invalid = errors.length > 0;
                  const value = typeof field.state.value === 'string' ? field.state.value : '';
                  return (
                    <Field data-invalid={invalid || undefined}>
                      <FieldLabel htmlFor={field.name} className="text-xs">
                        {t('shiftName')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder={t('shiftNamePlaceholder')}
                        aria-invalid={invalid || undefined}
                      />
                      {invalid && <FieldError errors={errors} />}
                    </Field>
                  );
                }}
              </form.AppField>

              <form.AppField name={`shifts[${index}].start`}>
                {(field: AnyFieldApi) => {
                  const errors = fieldErrorMessages(field);
                  const invalid = errors.length > 0;
                  const value = typeof field.state.value === 'string' ? field.state.value : '';
                  return (
                    <Field data-invalid={invalid || undefined}>
                      <FieldLabel htmlFor={field.name} className="text-xs">
                        {t('shiftStart')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="time"
                        value={value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={invalid || undefined}
                      />
                    </Field>
                  );
                }}
              </form.AppField>

              <form.AppField name={`shifts[${index}].end`}>
                {(field: AnyFieldApi) => {
                  const errors = fieldErrorMessages(field);
                  const invalid = errors.length > 0;
                  const value = typeof field.state.value === 'string' ? field.state.value : '';
                  return (
                    <Field data-invalid={invalid || undefined}>
                      <FieldLabel htmlFor={field.name} className="text-xs">
                        {t('shiftEnd')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="time"
                        value={value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={invalid || undefined}
                      />
                    </Field>
                  );
                }}
              </form.AppField>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => arrayField.removeValue(index)}
                aria-label={t('removeShift')}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => arrayField.pushValue({ name: '', start: '', end: '' })}
          >
            <Plus className="size-4" />
            {t('addShift')}
          </Button>
        </div>
      )}
    </form.Field>
  );
}
