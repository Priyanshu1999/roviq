'use client';

import { Button, Field, FieldError, FieldLabel, Input } from '@roviq/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { InstituteConfigFormValues } from '../schemas';

export function TermStructureBuilder() {
  const t = useTranslations('instituteSettings.config');
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<InstituteConfigFormValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'termStructure',
  });

  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-[1fr_auto_auto_auto] items-end gap-2 rounded-lg border p-3"
        >
          <Field data-invalid={!!errors.termStructure?.[index]?.label}>
            <FieldLabel className="text-xs">{t('termLabel')}</FieldLabel>
            <Input
              {...register(`termStructure.${index}.label`)}
              placeholder={t('termLabelPlaceholder')}
              aria-invalid={!!errors.termStructure?.[index]?.label}
            />
            {errors.termStructure?.[index]?.label && (
              <FieldError errors={[errors.termStructure[index].label]} />
            )}
          </Field>

          <Field data-invalid={!!errors.termStructure?.[index]?.start_date}>
            <FieldLabel className="text-xs">{t('termStartDate')}</FieldLabel>
            <Input
              type="date"
              {...register(`termStructure.${index}.start_date`)}
              aria-invalid={!!errors.termStructure?.[index]?.start_date}
            />
          </Field>

          <Field data-invalid={!!errors.termStructure?.[index]?.end_date}>
            <FieldLabel className="text-xs">{t('termEndDate')}</FieldLabel>
            <Input
              type="date"
              {...register(`termStructure.${index}.end_date`)}
              aria-invalid={!!errors.termStructure?.[index]?.end_date}
            />
          </Field>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => remove(index)}
            aria-label={t('removeTerm')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => append({ label: '', start_date: '', end_date: '' })}
      >
        <Plus className="size-4" />
        {t('addTerm')}
      </Button>
    </div>
  );
}
