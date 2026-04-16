'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { buildI18nTextSchema, emptyStringToUndefined, phoneSchema } from '@roviq/i18n';
import {
  Button,
  Can,
  Card,
  CardContent,
  FieldGroup,
  FieldLegend,
  FieldSet,
  I18nField,
  useAppForm,
  useBreadcrumbOverride,
} from '@roviq/ui';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../../hooks/use-form-draft';
import { useCreateStaffMember } from '../use-staff';

// ─── Canonical enum lists ─────────────────────────────────────────────────
// Mirrored from the detail page so every dropdown on the create and edit
// screens picks from the same canonical set. If the backend adds a new
// enum member, update both lists.
const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
const EMPLOYMENT_TYPES = ['REGULAR', 'CONTRACTUAL', 'PART_TIME', 'GUEST', 'VOLUNTEER'] as const;
const SOCIAL_CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as const;

// ─── Schema ───────────────────────────────────────────────────────────────

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    firstName: buildI18nTextSchema(t('new.errors.firstNameRequired')),
    lastName: buildI18nTextSchema(t('new.errors.firstNameRequired')).optional(),
    email: emptyStringToUndefined(z.string().email(t('errors.emailInvalid')).optional()),
    phone: emptyStringToUndefined(phoneSchema(t('errors.phoneInvalid')).optional()),
    gender: emptyStringToUndefined(z.enum(GENDERS).optional()),
    dateOfBirth: emptyStringToUndefined(z.string().optional()),
    socialCategory: emptyStringToUndefined(z.enum(SOCIAL_CATEGORIES).optional()),
    employeeId: emptyStringToUndefined(z.string().max(50).optional()),
    designation: emptyStringToUndefined(z.string().max(100).optional()),
    department: emptyStringToUndefined(z.string().max(100).optional()),
    employmentType: emptyStringToUndefined(z.enum(EMPLOYMENT_TYPES).optional()),
    dateOfJoining: emptyStringToUndefined(z.string().optional()),
    specialization: emptyStringToUndefined(z.string().max(200).optional()),
  });
}

type CreateStaffSchema = ReturnType<typeof buildSchema>;
type CreateStaffFormValues = z.input<CreateStaffSchema>;

const EMPTY_DEFAULTS: CreateStaffFormValues = {
  firstName: { en: '', hi: '' },
  lastName: undefined,
  email: '',
  phone: '',
  gender: undefined,
  dateOfBirth: '',
  socialCategory: undefined,
  employeeId: '',
  designation: '',
  department: '',
  employmentType: undefined,
  dateOfJoining: '',
  specialization: '',
};

// ─── Draft banner + header extracted to keep the page body shallow ────────

function DraftBanner({
  hasDraft,
  onRestore,
  onDiscard,
}: {
  hasDraft: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations('staff');
  if (!hasDraft) return null;
  return (
    <Card role="status" aria-live="polite">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{t('new.draftFound')}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDiscard}>
            {t('new.draftDiscard')}
          </Button>
          <Button type="button" size="sm" onClick={onRestore}>
            {t('new.draftRestore')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PageHeader({ onBack }: { onBack: () => void }) {
  const t = useTranslations('staff');
  return (
    <div className="flex items-start justify-between gap-4 print:hidden">
      <div className="space-y-1">
        <h1 data-testid="staff-new-title" className="text-2xl font-bold tracking-tight">
          {t('new.title')}
        </h1>
        <p className="text-muted-foreground">{t('new.description')}</p>
      </div>
      <Button
        data-testid="staff-new-back-btn"
        type="button"
        variant="ghost"
        size="sm"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('detail.back')}
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CreateStaffPage() {
  const t = useTranslations('staff');
  const router = useRouter();
  const [createStaffMember] = useCreateStaffMember();

  useBreadcrumbOverride({ new: t('new.title') });

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: EMPTY_DEFAULTS,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        const result = await createStaffMember({
          variables: {
            input: {
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              gender: parsed.gender,
              dateOfBirth: parsed.dateOfBirth,
              email: parsed.email,
              phone: parsed.phone,
              designation: parsed.designation,
              department: parsed.department,
              dateOfJoining: parsed.dateOfJoining,
              employmentType: parsed.employmentType,
              specialization: parsed.specialization,
            },
          },
        });
        toast.success(t('new.success'));
        clearDraft();
        const id = result.data?.createStaffMember.id;
        if (id) {
          router.push(`/institute/people/staff/${id}`);
        } else {
          router.push('/institute/people/staff');
        }
      } catch (err) {
        const message = extractGraphQLError(err, t('new.errors.generic'));
        if (message.includes('DUPLICATE') || message.includes('already exists')) {
          form.setFieldMeta('email', (prev) => ({
            ...prev,
            errorMap: { ...prev.errorMap, onChange: t('new.errors.duplicate') },
          }));
          toast.error(t('new.errors.duplicate'));
        } else {
          toast.error(t('new.errors.generic'), { description: message });
        }
      }
    },
  });

  const { hasDraft, restoreDraft, discardDraft, clearDraft } = useFormDraft<CreateStaffFormValues>({
    key: 'staff:new',
    form,
  });

  const handleCancel = () => router.push('/institute/people/staff');

  const genderOptions = GENDERS.map((g) => ({ value: g, label: t(`new.genders.${g}`) }));
  const socialOptions = SOCIAL_CATEGORIES.map((c) => ({
    value: c,
    label: t(`new.socialCategories.${c}`),
  }));
  const employmentTypeOptions = EMPLOYMENT_TYPES.map((e) => ({
    value: e,
    label: t(`new.employmentTypes.${e}`),
  }));

  return (
    <Can I="create" a="Staff" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <PageHeader onBack={handleCancel} />
            <DraftBanner hasDraft={hasDraft} onRestore={restoreDraft} onDiscard={discardDraft} />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
              noValidate
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
                    testId="staff-first-name"
                  />
                  <I18nField
                    form={form}
                    name="lastName"
                    label={t('new.fields.lastName')}
                    placeholder={t('new.placeholders.lastName')}
                    testId="staff-last-name"
                  />
                  <form.AppField name="gender">
                    {(field) => (
                      <field.SelectField
                        label={t('new.fields.gender')}
                        options={genderOptions}
                        placeholder={t('new.placeholders.gender')}
                        testId="staff-new-gender-select"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="dateOfBirth">
                    {(field) => (
                      <field.DateField
                        label={t('new.fields.dateOfBirth')}
                        description={t('new.fieldDescriptions.dateFormat')}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="socialCategory">
                    {(field) => (
                      <field.SelectField
                        label={t('new.fields.socialCategory')}
                        options={socialOptions}
                        placeholder={t('new.placeholders.socialCategory')}
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
                        testId="staff-new-email-input"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="phone">
                    {(field) => (
                      <field.PhoneField
                        label={t('new.fields.phone')}
                        description={t('new.fieldDescriptions.phoneFormat')}
                        placeholder={t('new.placeholders.phone')}
                        testId="staff-new-phone-input"
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>{t('new.sections.employment')}</FieldLegend>
                <FieldGroup>
                  <form.AppField name="employeeId">
                    {(field) => (
                      <field.TextField
                        label={t('new.fields.employeeId')}
                        placeholder={t('new.placeholders.employeeId')}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="designation">
                    {(field) => (
                      <field.TextField
                        label={t('new.fields.designation')}
                        placeholder={t('new.placeholders.designation')}
                        testId="staff-new-designation-input"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="department">
                    {(field) => (
                      <field.TextField
                        label={t('new.fields.department')}
                        placeholder={t('new.placeholders.department')}
                        testId="staff-new-department-input"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="employmentType">
                    {(field) => (
                      <field.SelectField
                        label={t('new.fields.employmentType')}
                        options={employmentTypeOptions}
                        placeholder={t('new.placeholders.employmentType')}
                        testId="staff-new-employment-type-select"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="dateOfJoining">
                    {(field) => (
                      <field.DateField
                        label={t('new.fields.dateOfJoining')}
                        description={t('new.fieldDescriptions.dateFormat')}
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </FieldSet>

              <div className="flex items-center justify-end gap-2 print:hidden">
                <Button
                  data-testid="staff-new-cancel-btn"
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                >
                  {t('new.cancel')}
                </Button>
                <form.AppForm>
                  <form.SubmitButton
                    testId="staff-new-submit-btn"
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
            <p className="text-muted-foreground">{t('accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}
