'use client';

import { ADMISSION_TYPE_VALUES, GENDER_VALUES, SOCIAL_CATEGORY_VALUES } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import {
  buildI18nTextSchema,
  dateSchema,
  emptyStringToUndefined,
  phoneSchema,
  useI18nField,
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
  Spinner,
  useAppForm,
  useBreadcrumbOverride,
} from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import { useStore } from '@tanstack/react-form';
import { useFormDraft } from '@web/hooks/use-form-draft';
import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  type AcademicYearNode,
  useAcademicYearsForStudents,
  useCreateStudent,
  useSectionsForStandard,
  useStandardsForYear,
} from '../use-students';

const { instituteStudents } = testIds;
function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    firstName: buildI18nTextSchema(t('new.errors.firstNameRequired')),
    lastName: buildI18nTextSchema(t('new.errors.lastNameRequired')).optional(),
    gender: emptyStringToUndefined(z.enum(GENDER_VALUES).optional()),
    dateOfBirth: emptyStringToUndefined(dateSchema(t('new.errors.dateInvalid')).optional()),
    phone: emptyStringToUndefined(phoneSchema(t('new.errors.phoneInvalid')).optional()),
    socialCategory: emptyStringToUndefined(z.enum(SOCIAL_CATEGORY_VALUES).optional()),
    academicYearId: z.uuid({ error: t('new.errors.academicYearRequired') }),
    standardId: z.uuid({ error: t('new.errors.standardRequired') }),
    sectionId: z.uuid({ error: t('new.errors.sectionRequired') }),
    admissionDate: emptyStringToUndefined(dateSchema(t('new.errors.dateInvalid')).optional()),
    admissionType: emptyStringToUndefined(z.enum(ADMISSION_TYPE_VALUES).optional()),
    // Orthogonal to `admissionType` — a transfer or lateral-entry student can
    // still be under the RTE quota, so the API models this as a boolean.
    isRteAdmitted: z.boolean().optional(),
  });
}

type StudentSchema = ReturnType<typeof buildSchema>;
type StudentFormValues = z.input<StudentSchema>;

export default function CreateStudentPage() {
  const t = useTranslations('students');
  const { data: yearsData, loading: yearsLoading } = useAcademicYearsForStudents();

  useBreadcrumbOverride({ new: t('new.title') });

  return (
    <Can I="create" a="Student" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          yearsLoading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <Spinner aria-label={t('new.loading')} />
            </div>
          ) : (
            <StudentForm years={yearsData?.academicYears ?? []} />
          )
        ) : (
          <div className="flex min-h-[400px] items-center justify-center">
            <p className="text-muted-foreground">{t('accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}

/**
 * Inner form component. Mounted only after the academic years query has
 * resolved, so `activeYear?.id` can be baked into `defaultValues` from the
 * start — TanStack Form's canonical async-initial-values pattern. No
 * post-mount `setFieldValue` hack is needed, which keeps `isDefaultValue`
 * true on an untouched form and prevents the draft hook from persisting an
 * "empty" draft that would spuriously trigger the restore banner on reload.
 */
function StudentForm({ years }: { years: readonly AcademicYearNode[] }) {
  const t = useTranslations('students');
  const resolveI18n = useI18nField();
  const router = useRouter();
  const [createStudent] = useCreateStudent();

  const schema = React.useMemo(() => buildSchema(t), [t]);
  const activeYear = years.find((y) => y.isActive);
  const defaultValues = React.useMemo<StudentFormValues>(
    () => ({
      firstName: { en: '' },
      lastName: undefined,
      gender: undefined,
      dateOfBirth: '',
      phone: '',
      socialCategory: undefined,
      academicYearId: activeYear?.id ?? '',
      standardId: '',
      sectionId: '',
      admissionDate: '',
      admissionType: undefined,
      isRteAdmitted: false,
    }),
    [activeYear?.id],
  );

  const form = useAppForm({
    defaultValues,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        const result = await createStudent({
          variables: {
            input: {
              firstName: parsed.firstName,
              lastName: parsed.lastName,
              gender: parsed.gender,
              dateOfBirth: parsed.dateOfBirth,
              phone: parsed.phone,
              socialCategory: parsed.socialCategory,
              academicYearId: parsed.academicYearId,
              standardId: parsed.standardId,
              sectionId: parsed.sectionId,
              admissionDate: parsed.admissionDate,
              admissionType: parsed.admissionType,
              isRteAdmitted: parsed.isRteAdmitted,
            },
          },
        });
        toast.success(t('new.success'));
        clearDraft();
        const id = result.data?.createStudent.id;
        router.push(id ? `/institute/people/students/${id}` : '/institute/people/students');
      } catch (err) {
        const message = extractGraphQLError(err, t('new.errors.generic'));
        toast.error(t('new.errors.generic'), { description: message });
      }
    },
  });

  const { hasDraft, restoreDraft, discardDraft, clearDraft } = useFormDraft<StudentFormValues>({
    key: 'students:new',
    form,
  });

  // Cascading-dropdown dependencies — render-prop trees can't read sibling
  // state without `useStore`.
  const academicYearId = useStore(
    form.store,
    (state) => (state.values as StudentFormValues).academicYearId,
  );
  const standardId = useStore(
    form.store,
    (state) => (state.values as StudentFormValues).standardId,
  );

  const { data: standardsData, loading: standardsLoading } = useStandardsForYear(academicYearId);
  const standards = standardsData?.standards ?? [];

  const { data: sectionsData, loading: sectionsLoading } = useSectionsForStandard(standardId);
  const sections = sectionsData?.sections ?? [];

  const handleCancel = () => router.push('/institute/people/students');

  const yearOptions = years.map((y) => ({
    value: y.id,
    label: y.isActive ? `${y.label} (${t('new.active')})` : y.label,
  }));
  const standardOptions = standards.map((s) => ({ value: s.id, label: resolveI18n(s.name) }));
  const sectionOptions = sections.map((s) => ({
    value: s.id,
    label: s.displayLabel ?? resolveI18n(s.name),
  }));
  const genderOptions = GENDER_VALUES.map((g) => ({ value: g, label: t(`new.genders.${g}`) }));
  const socialOptions = SOCIAL_CATEGORY_VALUES.map((c) => ({
    value: c,
    label: t(`new.socialCategories.${c}`),
  }));
  const admissionTypeOptions = ADMISSION_TYPE_VALUES.map((a) => ({
    value: a,
    label: t(`new.admissionTypes.${a}`),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <h1
            data-testid={instituteStudents.newTitle}
            className="text-2xl font-bold tracking-tight"
          >
            {t('new.title')}
          </h1>
          <p className="text-muted-foreground">{t('new.description')}</p>
        </div>
        <Button
          data-testid={instituteStudents.newBackBtn}
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
              testId="students-new-first-name"
            />
            <I18nField
              form={form}
              name="lastName"
              label={t('new.fields.lastName')}
              placeholder={t('new.placeholders.lastName')}
              testId="students-new-last-name"
            />
            <form.AppField name="gender">
              {(field) => (
                <field.SelectField
                  label={t('new.fields.gender')}
                  options={genderOptions}
                  placeholder={t('new.placeholders.gender')}
                  testId="students-new-gender-select"
                />
              )}
            </form.AppField>
            <form.AppField name="dateOfBirth">
              {(field) => (
                <field.DateField
                  label={t('new.fields.dateOfBirth')}
                  description={t('new.fieldDescriptions.dateFormat')}
                  testId="students-new-date-of-birth-input"
                />
              )}
            </form.AppField>
            <form.AppField name="socialCategory">
              {(field) => (
                <field.SelectField
                  label={t('new.fields.socialCategory')}
                  options={socialOptions}
                  placeholder={t('new.placeholders.socialCategory')}
                  testId="students-new-social-category-select"
                  info={
                    <FieldInfoPopover
                      title={t('new.fieldHelp.socialCategoryTitle')}
                      data-testid={instituteStudents.newSocialCategoryInfo}
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
            <form.AppField name="phone">
              {(field) => (
                <field.PhoneField
                  label={t('new.fields.phone')}
                  description={t('new.fieldDescriptions.phoneFormat')}
                  placeholder={t('new.placeholders.phone')}
                  testId="students-new-phone-input"
                />
              )}
            </form.AppField>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>{t('new.sections.admission')}</FieldLegend>
          <FieldGroup>
            <form.AppField
              name="academicYearId"
              listeners={{
                // Field-level `listeners.onChange` is TanStack Form's canonical
                // hook for dependent-field resets — fires only on actual value
                // change, not on initial mount.
                onChange: () => {
                  form.setFieldValue('standardId', '');
                  form.setFieldValue('sectionId', '');
                },
              }}
            >
              {(field) => (
                <field.SelectField
                  label={t('new.fields.academicYear')}
                  options={yearOptions}
                  placeholder={t('new.placeholders.academicYear')}
                  optional={false}
                  testId="students-new-academic-year-select"
                  info={
                    <FieldInfoPopover
                      title={t('new.fieldHelp.academicYearTitle')}
                      data-testid={instituteStudents.newAcademicYearInfo}
                    >
                      <p>{t('new.fieldHelp.academicYearBody')}</p>
                      <p>
                        <em>{t('new.fieldHelp.academicYearExample')}</em>
                      </p>
                    </FieldInfoPopover>
                  }
                />
              )}
            </form.AppField>
            <form.AppField
              name="standardId"
              listeners={{
                onChange: () => {
                  form.setFieldValue('sectionId', '');
                },
              }}
            >
              {(field) => (
                <field.SelectField
                  label={t('new.fields.standard')}
                  options={standardOptions}
                  placeholder={t('new.placeholders.standard')}
                  disabled={!academicYearId || standardsLoading || standards.length === 0}
                  optional={false}
                  testId="students-new-standard-select"
                />
              )}
            </form.AppField>
            <form.AppField name="sectionId">
              {(field) => (
                <field.SelectField
                  label={t('new.fields.section')}
                  options={sectionOptions}
                  placeholder={t('new.placeholders.section')}
                  disabled={!standardId || sectionsLoading || sections.length === 0}
                  optional={false}
                  testId="students-new-section-select"
                />
              )}
            </form.AppField>
            <form.AppField name="admissionDate">
              {(field) => (
                <field.DateField
                  label={t('new.fields.admissionDate')}
                  description={t('new.fieldDescriptions.dateFormat')}
                  testId="students-new-admission-date-input"
                />
              )}
            </form.AppField>
            <form.AppField name="admissionType">
              {(field) => (
                <field.SelectField
                  label={t('new.fields.admissionType')}
                  options={admissionTypeOptions}
                  placeholder={t('new.placeholders.admissionType')}
                  testId="students-new-admission-type-select"
                  info={
                    <FieldInfoPopover
                      title={t('new.fieldHelp.admissionTypeTitle')}
                      data-testid={instituteStudents.newAdmissionTypeInfo}
                    >
                      <p>{t('new.fieldHelp.admissionTypeBody')}</p>
                      <ul className="mt-1 list-disc space-y-0.5 ps-4">
                        <li>{t('new.fieldHelp.admissionTypeNew')}</li>
                        <li>{t('new.fieldHelp.admissionTypeLateral')}</li>
                        <li>{t('new.fieldHelp.admissionTypeReadmission')}</li>
                        <li>{t('new.fieldHelp.admissionTypeTransfer')}</li>
                      </ul>
                    </FieldInfoPopover>
                  }
                />
              )}
            </form.AppField>
            <form.AppField name="isRteAdmitted">
              {(field) => (
                <field.CheckboxField
                  label={t('new.fields.isRteAdmitted')}
                  description={t('new.fieldDescriptions.isRteAdmitted')}
                  testId="students-new-rte-admitted-checkbox"
                />
              )}
            </form.AppField>
          </FieldGroup>
        </FieldSet>

        <div className="flex items-center justify-end gap-2 print:hidden">
          <Button
            data-testid={instituteStudents.newCancelBtn}
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            {t('new.cancel')}
          </Button>
          <form.AppForm>
            <form.SubmitButton
              testId="students-new-submit-btn"
              submittingLabel={t('new.submitting')}
            >
              {t('new.submit')}
            </form.SubmitButton>
          </form.AppForm>
        </div>
      </form>
    </div>
  );
}
