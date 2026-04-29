'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { i18nTextSchema, useRouter, zodValidator } from '@roviq/i18n';
import { Button, Can, FieldGroup, I18nField, useAppForm } from '@roviq/ui';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { HOLIDAY_TYPE_VALUES, type HolidayType, useCreateHoliday } from '../use-holiday';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DESCRIPTION_MAX = 2000;

interface HolidayFormValues {
  name: Record<string, string>;
  description: string;
  type: HolidayType | '';
  startDate: string;
  endDate: string;
  tagsText: string;
  isPublic: boolean;
}

const EMPTY_FORM: HolidayFormValues = {
  name: { en: '', hi: '' },
  description: '',
  type: '',
  startDate: '',
  endDate: '',
  tagsText: '',
  isPublic: true,
};

function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z
    .object({
      name: i18nTextSchema,
      description: z.string().max(DESCRIPTION_MAX),
      type: z.enum(HOLIDAY_TYPE_VALUES),
      startDate: z.string().regex(ISO_DATE_REGEX, t('fields.startDate')),
      endDate: z.string().regex(ISO_DATE_REGEX, t('fields.endDate')),
      tagsText: z.string(),
      isPublic: z.boolean(),
    })
    .refine((d) => d.startDate <= d.endDate, {
      path: ['endDate'],
      message: t('errors.END_BEFORE_START'),
    });
}

export default function NewHolidayPage() {
  const t = useTranslations('holiday');
  const router = useRouter();
  const { mutate: createHoliday } = useCreateHoliday();

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: EMPTY_FORM,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        await createHoliday({
          name: parsed.name,
          description: parsed.description.trim() || null,
          type: parsed.type as HolidayType,
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          tags: parseTags(parsed.tagsText),
          isPublic: parsed.isPublic,
        });
        toast.success(t('actions.save'));
        router.push('/institute/holiday');
      } catch (err) {
        toast.error(extractGraphQLError(err, t('actions.save')));
      }
    },
  });

  const handleCancel = () => router.push('/institute/holiday');

  const typeOptions = HOLIDAY_TYPE_VALUES.map((v) => ({ value: v, label: t(`type.${v}`) }));

  return (
    <Can I="create" a="Holiday" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="mx-auto max-w-2xl space-y-6">
            <header className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="holiday-new-title">
                {t('newTitle')}
              </h1>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                data-testid="holiday-new-back-btn"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t('detail.back')}
              </Button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
              noValidate
              className="space-y-6"
            >
              <FieldGroup>
                <I18nField
                  form={form}
                  name="name"
                  label={t('fields.name')}
                  testId="holiday-new-name"
                />

                <form.AppField name="description">
                  {(field) => (
                    <field.TextareaField
                      label={t('fields.description')}
                      maxLength={DESCRIPTION_MAX}
                      rows={3}
                      testId="holiday-new-description"
                    />
                  )}
                </form.AppField>

                <form.AppField name="type">
                  {(field) => (
                    <field.SelectField
                      label={t('fields.type')}
                      options={typeOptions}
                      placeholder={t('fields.type')}
                      testId="holiday-new-type-select"
                    />
                  )}
                </form.AppField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <form.AppField name="startDate">
                    {(field) => (
                      <field.DateField
                        label={t('fields.startDate')}
                        testId="holiday-new-start-date"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="endDate">
                    {(field) => (
                      <field.DateField label={t('fields.endDate')} testId="holiday-new-end-date" />
                    )}
                  </form.AppField>
                </div>

                <form.AppField name="tagsText">
                  {(field) => (
                    <field.TextField
                      label={t('fields.tags')}
                      description={t('fields.tagsHint')}
                      placeholder="gazetted, restricted"
                      testId="holiday-new-tags"
                    />
                  )}
                </form.AppField>

                <form.AppField name="isPublic">
                  {(field) => (
                    <field.SwitchField
                      label={t('fields.isPublic')}
                      description={t('fields.isPublicHint')}
                      testId="holiday-new-is-public"
                    />
                  )}
                </form.AppField>
              </FieldGroup>

              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  data-testid="holiday-new-cancel-btn"
                >
                  {t('detail.back')}
                </Button>
                <form.AppForm>
                  <form.SubmitButton
                    testId="holiday-new-submit-btn"
                    submittingLabel={t('actions.saving')}
                  >
                    {t('actions.save')}
                  </form.SubmitButton>
                </form.AppForm>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground" data-testid="holiday-new-access-denied">
              {t('accessDenied')}
            </p>
          </div>
        )
      }
    </Can>
  );
}
