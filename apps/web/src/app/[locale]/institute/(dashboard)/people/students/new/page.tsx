'use client';

import { ADMISSION_TYPE_VALUES } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import {
  buildI18nTextSchema,
  emptyStringToUndefined,
  phoneSchema,
  useI18nField,
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
import { useStore } from '@tanstack/react-form';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../../hooks/use-form-draft';
import {
  useAcademicYearsForStudents,
  useCreateStudent,
  useSectionsForStandard,
  useStandardsForYear,
} from '../use-students';

const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
const SOCIAL_CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as const;

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    firstName: buildI18nTextSchema(t('new.errors.firstNameRequired')),
    lastName: buildI18nTextSchema(t('new.errors.lastNameRequired')).optional(),
    gender: emptyStringToUndefined(z.enum(GENDERS).optional()),
    dateOfBirth: emptyStringToUndefined(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')
        .optional(),
    ),
    phone: emptyStringToUndefined(phoneSchema(t('new.errors.phoneInvalid')).optional()),
    socialCategory: emptyStringToUndefined(z.enum(SOCIAL_CATEGORIES).optional()),
    isRteAdmitted: z.boolean().optional(),
    academicYearId: z.uuid({ error: t('new.errors.academicYearRequired') }),
    standardId: z.uuid({ error: t('new.errors.standardRequired') }),
    sectionId: z.uuid({ error: t('new.errors.sectionRequired') }),
    admissionDate: emptyStringToUndefined(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')
        .optional(),
    ),
    admissionType: emptyStringToUndefined(z.enum(ADMISSION_TYPE_VALUES).optional()),
  });
}

type StudentSchema = ReturnType<typeof buildSchema>;
type StudentFormValues = z.input<StudentSchema>;

const EMPTY_DEFAULTS: StudentFormValues = {
  firstName: { en: '', hi: '' },
  lastName: undefined,
  gender: undefined,
  dateOfBirth: '',
  phone: '',
  socialCategory: undefined,
  isRteAdmitted: undefined,
  academicYearId: '',
  standardId: '',
  sectionId: '',
  admissionDate: '',
  admissionType: undefined,
};

function DraftBanner({
  hasDraft,
  onRestore,
  onDiscard,
}: {
  hasDraft: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations('students');
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

export default function CreateStudentPage() {
  const t = useTranslations('students');
  const resolveI18n = useI18nField();
  const router = useRouter();
  const [createStudent] = useCreateStudent();

  useBreadcrumbOverride({ new: t('new.title') });

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: EMPTY_DEFAULTS,
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
              isRteAdmitted: parsed.isRteAdmitted,
              academicYearId: parsed.academicYearId,
              standardId: parsed.standardId,
              sectionId: parsed.sectionId,
              admissionDate: parsed.admissionDate,
              admissionType: parsed.admissionType,
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

  const { data: yearsData, loading: yearsLoading } = useAcademicYearsForStudents();
  const years = yearsData?.academicYears ?? [];
  const activeYear = years.find((y) => y.isActive);

  React.useEffect(() => {
    if (!academicYearId && activeYear) {
      form.setFieldValue('academicYearId', activeYear.id);
    }
  }, [academicYearId, activeYear, form]);

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
  const genderOptions = GENDERS.map((g) => ({ value: g, label: t(`new.genders.${g}`) }));
  const socialOptions = SOCIAL_CATEGORIES.map((c) => ({
    value: c,
    label: t(`new.socialCategories.${c}`),
  }));
  const admissionTypeOptions = ADMISSION_TYPE_VALUES.map((a) => ({
    value: a,
    label: t(`new.admissionTypes.${a}`),
  }));

  return (
    <Can I="create" a="Student" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="flex items-start justify-between gap-4 print:hidden">
              <div className="space-y-1">
                <h1 data-testid="students-new-title" className="text-2xl font-bold tracking-tight">
                  {t('new.title')}
                </h1>
                <p className="text-muted-foreground">{t('new.description')}</p>
              </div>
              <Button
                data-testid="students-new-back-btn"
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
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="phone">
                    {(field) => (
                      <field.PhoneField
                        label={t('new.fields.phone')}
                        description={t('new.fieldDescriptions.phoneFormat')}
                        placeholder={t('new.placeholders.phone')}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="socialCategory">
                    {(field) => (
                      <field.SelectField
                        label={t('new.fields.socialCategory')}
                        options={socialOptions}
                        placeholder={t('new.placeholders.socialCategory')}
                        info={
                          <FieldInfoPopover
                            title={t('new.fieldHelp.socialCategoryTitle')}
                            data-testid="students-new-social-category-info"
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
                <FieldLegend>{t('new.sections.admission')}</FieldLegend>
                <FieldGroup>
                  <form.AppField name="academicYearId">
                    {(field) => (
                      <field.SelectField
                        label={t('new.fields.academicYear')}
                        options={yearOptions}
                        placeholder={t('new.placeholders.academicYear')}
                        disabled={yearsLoading}
                        optional={false}
                        onValueChange={() => {
                          form.setFieldValue('standardId', '');
                          form.setFieldValue('sectionId', '');
                        }}
                        info={
                          <FieldInfoPopover
                            title={t('new.fieldHelp.academicYearTitle')}
                            data-testid="students-new-academic-year-info"
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
                  <form.AppField name="standardId">
                    {(field) => (
                      <field.SelectField
                        label={t('new.fields.standard')}
                        options={standardOptions}
                        placeholder={t('new.placeholders.standard')}
                        disabled={!academicYearId || standardsLoading || standards.length === 0}
                        optional={false}
                        testId="students-new-standard-select"
                        onValueChange={() => form.setFieldValue('sectionId', '')}
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
                        info={
                          <FieldInfoPopover
                            title={t('new.fieldHelp.admissionTypeTitle')}
                            data-testid="students-new-admission-type-info"
                          >
                            <p>{t('new.fieldHelp.admissionTypeBody')}</p>
                            <ul className="mt-1 list-disc space-y-0.5 ps-4">
                              <li>{t('new.fieldHelp.admissionTypeNew')}</li>
                              <li>{t('new.fieldHelp.admissionTypeRte')}</li>
                              <li>{t('new.fieldHelp.admissionTypeLateral')}</li>
                              <li>{t('new.fieldHelp.admissionTypeReadmission')}</li>
                              <li>{t('new.fieldHelp.admissionTypeTransfer')}</li>
                            </ul>
                          </FieldInfoPopover>
                        }
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </FieldSet>

              <div className="flex items-center justify-end gap-2 print:hidden">
                <Button
                  data-testid="students-new-cancel-btn"
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
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">{t('accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}
