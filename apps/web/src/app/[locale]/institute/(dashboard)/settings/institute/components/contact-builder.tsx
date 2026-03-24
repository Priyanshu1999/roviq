'use client';

import {
  Button,
  Checkbox,
  Field,
  FieldError,
  FieldLabel,
  FieldSet,
  Input,
  Switch,
} from '@roviq/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { InstituteInfoFormValues } from '../schemas';

export function ContactBuilder() {
  const t = useTranslations('instituteSettings.info');
  const {
    register,
    control,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext<InstituteInfoFormValues>();

  const {
    fields: phoneFields,
    append: appendPhone,
    remove: removePhone,
  } = useFieldArray({ control, name: 'contact.phones' });

  const {
    fields: emailFields,
    append: appendEmail,
    remove: removeEmail,
  } = useFieldArray({ control, name: 'contact.emails' });

  const phones = watch('contact.phones');

  function handlePrimaryChange(index: number) {
    phones.forEach((_, i) => {
      setValue(`contact.phones.${i}.is_primary`, i === index, {
        shouldDirty: true,
      });
    });
  }

  return (
    <div className="space-y-8">
      {/* Phone Numbers */}
      <FieldSet>
        <FieldLabel>{t('phones')}</FieldLabel>
        {errors.contact?.phones?.root && <FieldError errors={[errors.contact.phones.root]} />}
        {errors.contact?.phones && typeof errors.contact.phones.message === 'string' && (
          <FieldError errors={[errors.contact.phones as { message: string }]} />
        )}

        <div className="space-y-3">
          {phoneFields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-[80px_1fr_auto_auto_1fr_auto] items-end gap-2 rounded-lg border p-3"
            >
              <Field>
                <FieldLabel className="text-xs">{t('countryCode')}</FieldLabel>
                <Input
                  {...register(`contact.phones.${index}.country_code`)}
                  className="text-center"
                  readOnly
                />
              </Field>

              <Field data-invalid={!!errors.contact?.phones?.[index]?.number}>
                <FieldLabel className="text-xs">{t('phoneNumber')}</FieldLabel>
                <Input
                  {...register(`contact.phones.${index}.number`)}
                  placeholder={t('phonePlaceholder')}
                  inputMode="numeric"
                  maxLength={10}
                  aria-invalid={!!errors.contact?.phones?.[index]?.number}
                />
                {errors.contact?.phones?.[index]?.number && (
                  <FieldError errors={[errors.contact.phones[index].number]} />
                )}
              </Field>

              <Field>
                <FieldLabel className="text-xs">{t('isPrimary')}</FieldLabel>
                <div className="flex h-8 items-center">
                  <Checkbox
                    checked={phones[index]?.is_primary ?? false}
                    onCheckedChange={() => handlePrimaryChange(index)}
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel className="text-xs">{t('isWhatsappEnabled')}</FieldLabel>
                <div className="flex h-8 items-center">
                  <Switch
                    checked={phones[index]?.is_whatsapp_enabled ?? false}
                    onCheckedChange={(v) =>
                      setValue(`contact.phones.${index}.is_whatsapp_enabled`, v, {
                        shouldDirty: true,
                      })
                    }
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel className="text-xs">{t('phoneLabel')}</FieldLabel>
                <Input
                  {...register(`contact.phones.${index}.label`)}
                  placeholder={t('phoneLabelPlaceholder')}
                />
              </Field>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removePhone(index)}
                aria-label={t('removePhone')}
                disabled={phoneFields.length <= 1}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            appendPhone({
              country_code: '+91',
              number: '',
              is_primary: phoneFields.length === 0,
              is_whatsapp_enabled: phoneFields.length === 0,
              label: '',
            })
          }
        >
          <Plus className="size-4" />
          {t('addPhone')}
        </Button>
      </FieldSet>

      {/* Email Addresses */}
      <FieldSet>
        <FieldLabel>{t('emails')}</FieldLabel>
        <div className="space-y-3">
          {emailFields.map((field, index) => (
            <div
              key={field.id}
              className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2 rounded-lg border p-3"
            >
              <Field data-invalid={!!errors.contact?.emails?.[index]?.address}>
                <FieldLabel className="text-xs">{t('emailAddress')}</FieldLabel>
                <Input
                  {...register(`contact.emails.${index}.address`)}
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  aria-invalid={!!errors.contact?.emails?.[index]?.address}
                />
                {errors.contact?.emails?.[index]?.address && (
                  <FieldError errors={[errors.contact.emails[index].address]} />
                )}
              </Field>

              <Field>
                <FieldLabel className="text-xs">{t('emailIsPrimary')}</FieldLabel>
                <div className="flex h-8 items-center">
                  <Checkbox
                    checked={watch(`contact.emails.${index}.is_primary`)}
                    onCheckedChange={(v) =>
                      setValue(`contact.emails.${index}.is_primary`, !!v, {
                        shouldDirty: true,
                      })
                    }
                  />
                </div>
              </Field>

              <Field>
                <FieldLabel className="text-xs">{t('emailLabel')}</FieldLabel>
                <Input
                  {...register(`contact.emails.${index}.label`)}
                  placeholder={t('emailLabelPlaceholder')}
                />
              </Field>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeEmail(index)}
                aria-label={t('removeEmail')}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => appendEmail({ address: '', is_primary: false, label: '' })}
        >
          <Plus className="size-4" />
          {t('addEmail')}
        </Button>
      </FieldSet>
    </div>
  );
}
