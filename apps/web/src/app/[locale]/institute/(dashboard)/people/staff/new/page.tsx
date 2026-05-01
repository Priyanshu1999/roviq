'use client';

import { EMPLOYMENT_TYPE_VALUES, GENDER_VALUES, SOCIAL_CATEGORY_VALUES } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import {
  buildI18nTextSchema,
  dateSchema,
  emptyStringToUndefined,
  phoneSchema,
  useRouter,
  zodValidator,
} from '@roviq/i18n';
import {
  Button,
  Can,
  DraftBanner,
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
import { useCreateStaffMember } from '../use-staff';

const { instituteStaff } = testIds;
// ─── Schema ───────────────────────────────────────────────────────────────

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    firstName: buildI18nTextSchema(t('new.errors.firstNameRequired')),
    lastName: buildI18nTextSchema(t('new.errors.lastNameRequired')).optional(),
    email: emptyStringToUndefined(z.string().email(t('new.errors.emailInvalid')).optional()),
    phone: emptyStringToUndefined(phoneSchema(t('new.errors.phoneInvalid')).optional()),
    gender: emptyStringToUndefined(z.enum(GENDER_VALUES).optional()),
    dateOfBirth: emptyStringToUndefined(dateSchema(t('new.errors.dateInvalid')).optional()),
    socialCategory: emptyStringToUndefined(z.enum(SOCIAL_CATEGORY_VALUES).optional()),
    employeeId: emptyStringToUndefined(z.string().max(50).optional()),
    designation: emptyStringToUndefined(z.string().max(100).optional()),
    department: emptyStringToUndefined(z.string().max(100).optional()),
    employmentType: emptyStringToUndefined(z.enum(EMPLOYMENT_TYPE_VALUES).optional()),
    dateOfJoining: emptyStringToUndefined(dateSchema(t('new.errors.dateInvalid')).optional()),
    specialization: emptyStringToUndefined(z.string().max(200).optional()),
  });
}

type CreateStaffSchema = ReturnType<typeof buildSchema>;
type CreateStaffFormValues = z.input<CreateStaffSchema>;

const EMPTY_DEFAULTS: CreateStaffFormValues = {
  firstName: { en: '' },
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

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CreateStaffPage() {
  const t = useTranslations('staff');
  const router = useRouter();
  const [createStaffMember] = useCreateStaffMember();

  useBreadcrumbOverride({ new: t('new.title') });

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: EMPTY_DEFAULTS,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
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
        router.push(id ? `/institute/people/staff/${id}` : '/institute/people/staff');
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

  const genderOptions = GENDER_VALUES.map((g) => ({ value: g, label: t(`new.genders.${g}`) }));
  const socialOptions = SOCIAL_CATEGORY_VALUES.map((c) => ({
    value: c,
    label: t(`new.socialCategories.${c}`),
  }));
  const employmentTypeOptions = EMPLOYMENT_TYPE_VALUES.map((e) => ({
    value: e,
    label: t(`new.employmentTypes.${e}`),
  }));

  return (
    <Can I="create" a="Staff" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-start justify-between gap-4 print:hidden">
              <div className="space-y-1">
                <h1
                  data-testid={instituteStaff.newTitle}
                  className="text-2xl font-bold tracking-tight"
                >
                  {t('new.title')}
                </h1>
                <p className="text-muted-foreground">{t('new.description')}</p>
              </div>
              <Button
                data-testid={instituteStaff.newBackBtn}
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t('detail.back')}
              </Button>
            </div>

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
                    testId="staff-new-first-name"
                  />
                  <I18nField
                    form={form}
                    name="lastName"
                    label={t('new.fields.lastName')}
                    placeholder={t('new.placeholders.lastName')}
                    testId="staff-new-last-name"
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
                        testId="staff-new-date-of-birth-input"
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="socialCategory">
                    {(field) => (
                      <field.SelectField
                        label={t('new.fields.socialCategory')}
                        options={socialOptions}
                        placeholder={t('new.placeholders.socialCategory')}
                        testId="staff-new-social-category-select"
                        info={
                          <FieldInfoPopover
                            title={t('new.fieldHelp.socialCategoryTitle')}
                            data-testid={instituteStaff.newSocialCategoryInfo}
                          >
                            <p>{t('new.fieldHelp.socialCategoryBody')}</p>
                            <p>{t('new.fieldHelp.socialCategoryOptions')}</p>
                          </FieldInfoPopover>
                        }
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
                        testId="staff-new-employee-id-input"
                        info={
                          <FieldInfoPopover
                            title={t('new.fieldHelp.employeeIdTitle')}
                            data-testid={instituteStaff.newEmployeeIdInfo}
                          >
                            <p>{t('new.fieldHelp.employeeIdBody')}</p>
                            <p>
                              <em>{t('new.fieldHelp.employeeIdExample')}</em>
                            </p>
                          </FieldInfoPopover>
                        }
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="designation">
                    {(field) => (
                      <field.TextField
                        label={t('new.fields.designation')}
                        placeholder={t('new.placeholders.designation')}
                        testId="staff-new-designation-input"
                        info={
                          <FieldInfoPopover
                            title={t('new.fieldHelp.designationTitle')}
                            data-testid={instituteStaff.newDesignationInfo}
                          >
                            <p>{t('new.fieldHelp.designationBody')}</p>
                            <p>
                              <em>{t('new.fieldHelp.designationExample')}</em>
                            </p>
                          </FieldInfoPopover>
                        }
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="department">
                    {(field) => (
                      <field.TextField
                        label={t('new.fields.department')}
                        placeholder={t('new.placeholders.department')}
                        testId="staff-new-department-input"
                        info={
                          <FieldInfoPopover
                            title={t('new.fieldHelp.departmentTitle')}
                            data-testid={instituteStaff.newDepartmentInfo}
                          >
                            <p>{t('new.fieldHelp.departmentBody')}</p>
                            <p>
                              <em>{t('new.fieldHelp.departmentExample')}</em>
                            </p>
                          </FieldInfoPopover>
                        }
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
                        info={
                          <FieldInfoPopover
                            title={t('new.fieldHelp.employmentTypeTitle')}
                            data-testid={instituteStaff.newEmploymentTypeInfo}
                          >
                            <p>{t('new.fieldHelp.employmentTypeBody')}</p>
                            <ul className="mt-1 list-disc space-y-0.5 ps-4">
                              <li>{t('new.fieldHelp.employmentTypeRegular')}</li>
                              <li>{t('new.fieldHelp.employmentTypeContractual')}</li>
                              <li>{t('new.fieldHelp.employmentTypePartTime')}</li>
                              <li>{t('new.fieldHelp.employmentTypeGuest')}</li>
                              <li>{t('new.fieldHelp.employmentTypeVolunteer')}</li>
                            </ul>
                          </FieldInfoPopover>
                        }
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="dateOfJoining">
                    {(field) => (
                      <field.DateField
                        label={t('new.fields.dateOfJoining')}
                        description={t('new.fieldDescriptions.dateFormat')}
                        testId="staff-new-date-of-joining-input"
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </FieldSet>

              <div className="flex items-center justify-end gap-2 print:hidden">
                <Button
                  data-testid={instituteStaff.newCancelBtn}
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

import { testIds } from '@roviq/ui/testing/testid-registry';
