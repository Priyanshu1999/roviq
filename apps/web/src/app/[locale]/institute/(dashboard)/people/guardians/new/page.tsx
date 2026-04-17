'use client';

import { GUARDIAN_EDUCATION_LEVEL_VALUES, GuardianEducationLevel } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import {
  buildI18nTextSchema,
  emptyStringToUndefined,
  phoneSchema,
  useRouter,
  zodValidator,
} from '@roviq/i18n';
import {
  Button,
  Can,
  Card,
  CardContent,
  FieldGroup,
  FieldInfoPopover,
  FieldLegend,
  FieldSet,
  I18nField,
  useAppForm,
  useBreadcrumbOverride,
} from '@roviq/ui';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../../hooks/use-form-draft';
import { useCreateGuardian } from '../use-guardians';

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    firstName: buildI18nTextSchema(t('new.errors.firstNameRequired')),
    lastName: buildI18nTextSchema(t('new.errors.lastNameRequired')).optional(),
    gender: z.enum(GENDERS).optional(),
    email: emptyStringToUndefined(z.string().email(t('new.errors.emailInvalid')).optional()),
    phone: emptyStringToUndefined(phoneSchema(t('new.errors.phoneInvalid')).optional()),
    occupation: emptyStringToUndefined(z.string().max(100).optional()),
    organization: emptyStringToUndefined(z.string().max(100).optional()),
    educationLevel: z.enum(GuardianEducationLevel).optional(),
  });
}

type GuardianSchema = ReturnType<typeof buildSchema>;
type GuardianFormValues = z.input<GuardianSchema>;

const EMPTY_DEFAULTS: GuardianFormValues = {
  firstName: { en: '' },
  lastName: undefined,
  gender: undefined,
  email: '',
  phone: '',
  occupation: '',
  organization: '',
  educationLevel: undefined,
};

export default function CreateGuardianPage() {
  const t = useTranslations('guardians');
  const router = useRouter();
  const [createGuardian] = useCreateGuardian();

  useBreadcrumbOverride({ new: t('new.title') });

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: EMPTY_DEFAULTS,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        const result = await createGuardian({
          variables: {
            input: {
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              gender: parsed.gender,
              email: parsed.email,
              phone: parsed.phone,
              occupation: parsed.occupation,
              organization: parsed.organization,
              educationLevel: parsed.educationLevel,
            },
          },
        });
        toast.success(t('new.success'));
        clearDraft();
        const id = result.data?.createGuardian.id;
        router.push(id ? `/people/guardians/${id}` : '/people/guardians');
      } catch (err) {
        const message = extractGraphQLError(err, t('new.errors.generic'));
        toast.error(t('new.errors.generic'), { description: message });
      }
    },
  });

  const { hasDraft, restoreDraft, discardDraft, clearDraft } = useFormDraft<GuardianFormValues>({
    key: 'guardians:new',
    form,
  });

  const handleCancel = () => router.push('/people/guardians');

  const genderOptions = GENDERS.map((g) => ({ value: g, label: t(`new.genders.${g}`) }));
  const educationLevelOptions = GUARDIAN_EDUCATION_LEVEL_VALUES.map((level) => ({
    value: level,
    label: t(`new.educationLevels.${level}`),
  }));

  return (
    <Can I="create" a="Guardian" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-start justify-between gap-4 print:hidden">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight" data-testid="guardian-new-title">
                  {t('new.title')}
                </h1>
                <p className="text-muted-foreground">{t('new.description')}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                data-testid="guardian-new-back-btn"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t('new.back')}
              </Button>
            </div>

            {hasDraft && (
              <Card role="status" aria-live="polite">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <p className="text-sm font-medium">{t('new.draftFound')}</p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={discardDraft}>
                      {t('new.draftDiscard')}
                    </Button>
                    <Button type="button" size="sm" onClick={restoreDraft}>
                      {t('new.draftRestore')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
              className="space-y-6"
            >
              <FieldSet>
                <FieldLegend>{t('new.sections.personal')}</FieldLegend>
                <FieldGroup>
                  <I18nField
                    form={form}
                    name="firstName"
                    label={t('new.fields.firstName')}
                    placeholder={t('new.placeholders.firstName')}
                    testId="guardian-first-name"
                  />
                  <I18nField
                    form={form}
                    name="lastName"
                    label={t('new.fields.lastName')}
                    placeholder={t('new.placeholders.lastName')}
                    testId="guardian-last-name"
                  />
                  <form.AppField name="gender">
                    {(field) => (
                      <field.SelectField
                        label={t('new.fields.gender')}
                        options={genderOptions}
                        placeholder={t('new.placeholders.gender')}
                        testId="guardian-new-gender-select"
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>{t('new.sections.contact')}</FieldLegend>
                <FieldGroup>
                  <form.AppField name="email">
                    {(field) => (
                      <field.TextField
                        label={t('new.fields.email')}
                        type="email"
                        autoComplete="email"
                        placeholder={t('new.placeholders.email')}
                        testId="guardian-new-email-input"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="phone">
                    {(field) => (
                      <field.PhoneField
                        label={t('new.fields.phone')}
                        description={t('new.fieldDescriptions.phoneFormat')}
                        placeholder={t('new.placeholders.phone')}
                        testId="guardian-new-phone-input"
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>{t('new.sections.professional')}</FieldLegend>
                <FieldGroup>
                  <form.AppField name="occupation">
                    {(field) => (
                      <field.TextField
                        label={t('new.fields.occupation')}
                        placeholder={t('new.placeholders.occupation')}
                        testId="guardian-new-occupation-input"
                        maxLength={100}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="organization">
                    {(field) => (
                      <field.TextField
                        label={t('new.fields.organization')}
                        placeholder={t('new.placeholders.organization')}
                        maxLength={100}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="educationLevel">
                    {(field) => (
                      <field.SelectField
                        label={t('new.fields.educationLevel')}
                        options={educationLevelOptions}
                        placeholder={t('new.placeholders.educationLevel')}
                        testId="guardian-new-education-level-select"
                        info={
                          <FieldInfoPopover
                            title={t('new.fieldHelp.educationLevelTitle')}
                            data-testid="guardian-new-education-level-info"
                          >
                            <p>{t('new.fieldHelp.educationLevelBody')}</p>
                            <p>{t('new.fieldHelp.educationLevelOptions')}</p>
                          </FieldInfoPopover>
                        }
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </FieldSet>

              <div className="flex items-center justify-end gap-2 print:hidden">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t('new.cancel')}
                </Button>
                <form.AppForm>
                  <form.SubmitButton
                    testId="guardian-new-submit-btn"
                    submittingLabel={t('new.submitting')}
                  >
                    {t('new.submit')}
                  </form.SubmitButton>
                </form.AppForm>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">{t('new.accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}
