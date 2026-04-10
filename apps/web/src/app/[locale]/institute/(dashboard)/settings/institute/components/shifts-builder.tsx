'use client';

import { Button, Field, FieldError, FieldLabel, Input } from '@roviq/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { InstituteConfigFormValues } from '../schemas';

export function ShiftsBuilder() {
  const t = useTranslations('instituteSettings.config');
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<InstituteConfigFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'shifts',
  });

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-lg border p-3"
        >
          <Field data-invalid={!!errors.shifts?.[index]?.name}>
            <FieldLabel className="text-xs">{t('shiftName')}</FieldLabel>
            <Input
              {...register(`shifts.${index}.name`)}
              placeholder={t('shiftNamePlaceholder')}
              aria-invalid={!!errors.shifts?.[index]?.name}
            />
            {errors.shifts?.[index]?.name && <FieldError errors={[errors.shifts[index].name]} />}
          </Field>

          <Field data-invalid={!!errors.shifts?.[index]?.start}>
            <FieldLabel className="text-xs">{t('shiftStart')}</FieldLabel>
            <Input
              type="time"
              {...register(`shifts.${index}.start`)}
              aria-invalid={!!errors.shifts?.[index]?.start}
            />
          </Field>

          <Field data-invalid={!!errors.shifts?.[index]?.end}>
            <FieldLabel className="text-xs">{t('shiftEnd')}</FieldLabel>
            <Input
              type="time"
              {...register(`shifts.${index}.end`)}
              aria-invalid={!!errors.shifts?.[index]?.end}
            />
          </Field>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(index)}
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
        onClick={() => append({ name: '', start: '', end: '' })}
      >
        <Plus className="size-4" />
        {t('addShift')}
      </Button>
    </div>
  );
}
