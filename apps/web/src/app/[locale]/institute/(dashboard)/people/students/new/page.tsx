'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { extractGraphQLError } from '@roviq/graphql';
import { i18nTextOptionalSchema, i18nTextSchema } from '@roviq/i18n';
import {
  Button,
  Can,
  Card,
  CardContent,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  I18nInput,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useBreadcrumbOverride,
} from '@roviq/ui';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import {
  Controller,
  FormProvider,
  type Resolver,
  type UseFormReturn,
  useForm,
  useFormContext,
} from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../../hooks/use-form-draft';
import {
  useAcademicYearsForStudents,
  useCreateStudent,
  useSectionsForStandard,
  useStandardsForYear,
} from '../use-students';

// ─── Canonical enum lists (mirror backend validators) ────────────────────
const GENDERS = ['male', 'female', 'other'] as const;
const SOCIAL_CATEGORIES = ['general', 'obc', 'sc', 'st', 'ews'] as const;
const ADMISSION_TYPES = ['new', 'rte', 'lateral_entry', 're_admission', 'transfer'] as const;

// ─── Schema ───────────────────────────────────────────────────────────────

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    firstName: i18nTextSchema,
    lastName: i18nTextOptionalSchema,
    gender: z.enum(GENDERS).optional(),
    dateOfBirth: z
      .string()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, t('new.errors.phoneInvalid'))
      .optional()
      .or(z.literal('').transform(() => undefined)),
    socialCategory: z.enum(SOCIAL_CATEGORIES).optional(),
    isRteAdmitted: z.boolean().optional(),
    academicYearId: z.string().uuid(t('new.errors.academicYearRequired')),
    standardId: z.string().uuid(t('new.errors.standardRequired')),
    sectionId: z.string().uuid(t('new.errors.sectionRequired')),
    admissionDate: z
      .string()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    admissionType: z.enum(ADMISSION_TYPES).optional(),
  });
}

type CreateStudentFormValues = z.infer<ReturnType<typeof buildSchema>>;

// ─── Section: Personal ────────────────────────────────────────────────────

function PersonalSection() {
  const t = useTranslations('students');
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<CreateStudentFormValues>();

  return (
    <FieldSet>
      <FieldLegend>{t('new.sections.personal')}</FieldLegend>
      <FieldGroup>
        <I18nInput<CreateStudentFormValues>
          name="firstName"
          label={t('new.fields.firstName')}
          placeholder={t('new.placeholders.firstName')}
        />
        <I18nInput<CreateStudentFormValues>
          name="lastName"
          label={t('new.fields.lastName')}
          placeholder={t('new.placeholders.lastName')}
        />
        <Field data-invalid={errors.gender ? true : undefined}>
          <FieldLabel htmlFor="gender">{t('new.fields.gender')}</FieldLabel>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder={t('new.placeholders.gender')} />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {t(`new.genders.${g}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.gender && <FieldError>{errors.gender.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.dateOfBirth ? true : undefined}>
          <FieldLabel htmlFor="dateOfBirth">{t('new.fields.dateOfBirth')}</FieldLabel>
          <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
          <FieldDescription>{t('new.fieldDescriptions.dateFormat')}</FieldDescription>
          {errors.dateOfBirth && <FieldError>{errors.dateOfBirth.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.phone ? true : undefined}>
          <FieldLabel htmlFor="phone">{t('new.fields.phone')}</FieldLabel>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" aria-hidden="true">
              +91
            </span>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              placeholder={t('new.placeholders.phone')}
              {...register('phone')}
            />
          </div>
          <FieldDescription>{t('new.fieldDescriptions.phoneFormat')}</FieldDescription>
          {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.socialCategory ? true : undefined}>
          <FieldLabel htmlFor="socialCategory">{t('new.fields.socialCategory')}</FieldLabel>
          <Controller
            control={control}
            name="socialCategory"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="socialCategory">
                  <SelectValue placeholder={t('new.placeholders.socialCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`new.socialCategories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.socialCategory && <FieldError>{errors.socialCategory.message}</FieldError>}
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ─── Section: Admission ──────────────────────────────────────────────────

function AdmissionSection() {
  const t = useTranslations('students');
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<CreateStudentFormValues>();

  const academicYearId = watch('academicYearId');
  const standardId = watch('standardId');

  const { data: yearsData, loading: yearsLoading } = useAcademicYearsForStudents();
  const years = yearsData?.academicYears ?? [];
  const activeYear = years.find((y) => y.isActive);

  // Default to active academic year once loaded.
  React.useEffect(() => {
    if (!academicYearId && activeYear) {
      setValue('academicYearId', activeYear.id, { shouldValidate: true });
    }
  }, [academicYearId, activeYear, setValue]);

  const { data: standardsData, loading: standardsLoading } = useStandardsForYear(academicYearId);
  const standards = standardsData?.standards ?? [];

  const { data: sectionsData, loading: sectionsLoading } = useSectionsForStandard(standardId);
  const sections = sectionsData?.sections ?? [];

  return (
    <FieldSet>
      <FieldLegend>{t('new.sections.admission')}</FieldLegend>
      <FieldGroup>
        <Field data-invalid={errors.academicYearId ? true : undefined}>
          <FieldLabel htmlFor="academicYearId">{t('new.fields.academicYear')}</FieldLabel>
          <Controller
            control={control}
            name="academicYearId"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={(v) => {
                  field.onChange(v);
                  // Reset dependent selections.
                  setValue('standardId', '', { shouldValidate: false });
                  setValue('sectionId', '', { shouldValidate: false });
                }}
                disabled={yearsLoading}
              >
                <SelectTrigger id="academicYearId">
                  <SelectValue placeholder={t('new.placeholders.academicYear')} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.label}
                      {y.isActive ? ` (${t('new.active')})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.academicYearId && <FieldError>{errors.academicYearId.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.standardId ? true : undefined}>
          <FieldLabel htmlFor="standardId">{t('new.fields.standard')}</FieldLabel>
          <Controller
            control={control}
            name="standardId"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={(v) => {
                  field.onChange(v);
                  setValue('sectionId', '', { shouldValidate: false });
                }}
                disabled={!academicYearId || standardsLoading || standards.length === 0}
              >
                <SelectTrigger id="standardId">
                  <SelectValue placeholder={t('new.placeholders.standard')} />
                </SelectTrigger>
                <SelectContent>
                  {standards.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.standardId && <FieldError>{errors.standardId.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.sectionId ? true : undefined}>
          <FieldLabel htmlFor="sectionId">{t('new.fields.section')}</FieldLabel>
          <Controller
            control={control}
            name="sectionId"
            render={({ field }) => (
              <Select
                value={field.value ?? ''}
                onValueChange={field.onChange}
                disabled={!standardId || sectionsLoading || sections.length === 0}
              >
                <SelectTrigger id="sectionId">
                  <SelectValue placeholder={t('new.placeholders.section')} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.displayLabel ?? s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.sectionId && <FieldError>{errors.sectionId.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.admissionDate ? true : undefined}>
          <FieldLabel htmlFor="admissionDate">{t('new.fields.admissionDate')}</FieldLabel>
          <Input id="admissionDate" type="date" {...register('admissionDate')} />
          <FieldDescription>{t('new.fieldDescriptions.dateFormat')}</FieldDescription>
          {errors.admissionDate && <FieldError>{errors.admissionDate.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.admissionType ? true : undefined}>
          <FieldLabel htmlFor="admissionType">{t('new.fields.admissionType')}</FieldLabel>
          <Controller
            control={control}
            name="admissionType"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="admissionType">
                  <SelectValue placeholder={t('new.placeholders.admissionType')} />
                </SelectTrigger>
                <SelectContent>
                  {ADMISSION_TYPES.map((a) => (
                    <SelectItem key={a} value={a}>
                      {t(`new.admissionTypes.${a}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.admissionType && <FieldError>{errors.admissionType.message}</FieldError>}
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ─── Draft banner + header ────────────────────────────────────────────────

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

function PageHeader({ onBack }: { onBack: () => void }) {
  const t = useTranslations('students');
  return (
    <div className="flex items-start justify-between gap-4 print:hidden">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{t('new.title')}</h1>
        <p className="text-muted-foreground">{t('new.description')}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t('detail.back')}
      </Button>
    </div>
  );
}

function PageFooterActions({
  onCancel,
  isSubmitting,
}: {
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const t = useTranslations('students');
  return (
    <div className="flex items-center justify-end gap-2 print:hidden">
      <Button type="button" variant="outline" onClick={onCancel}>
        {t('new.cancel')}
      </Button>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {isSubmitting ? t('new.submitting') : t('new.submit')}
      </Button>
    </div>
  );
}

// ─── Form body ────────────────────────────────────────────────────────────

function StudentCreateFormBody({
  form,
  onSubmit,
  onCancel,
  draftHasDraft,
  draftRestore,
  draftDiscard,
}: {
  form: UseFormReturn<CreateStudentFormValues>;
  onSubmit: (values: CreateStudentFormValues) => Promise<void>;
  onCancel: () => void;
  draftHasDraft: boolean;
  draftRestore: () => void;
  draftDiscard: () => void;
}) {
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader onBack={onCancel} />
      <DraftBanner hasDraft={draftHasDraft} onRestore={draftRestore} onDiscard={draftDiscard} />
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          <PersonalSection />
          <AdmissionSection />
          <PageFooterActions onCancel={onCancel} isSubmitting={isSubmitting} />
        </form>
      </FormProvider>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CreateStudentPage() {
  const t = useTranslations('students');
  const router = useRouter();
  const [createStudent] = useCreateStudent();

  useBreadcrumbOverride({ new: t('new.title') });

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const defaultValues: CreateStudentFormValues = React.useMemo(
    () => ({
      firstName: { en: '' },
      lastName: undefined,
      gender: undefined,
      dateOfBirth: undefined,
      phone: undefined,
      socialCategory: undefined,
      isRteAdmitted: undefined,
      academicYearId: '',
      standardId: '',
      sectionId: '',
      admissionDate: undefined,
      admissionType: undefined,
    }),
    [],
  );

  const form = useForm<CreateStudentFormValues>({
    resolver: zodResolver(schema) as Resolver<CreateStudentFormValues>,
    defaultValues,
    mode: 'onBlur',
  });

  const draft = useFormDraft<CreateStudentFormValues>({
    key: 'students:new',
    form,
    enabled: !form.formState.isSubmitting,
  });

  const onSubmit = async (values: CreateStudentFormValues) => {
    try {
      const result = await createStudent({
        variables: {
          input: {
            firstName: values.firstName,
            lastName: values.lastName,
            gender: values.gender,
            dateOfBirth: values.dateOfBirth,
            phone: values.phone,
            socialCategory: values.socialCategory,
            isRteAdmitted: values.isRteAdmitted,
            academicYearId: values.academicYearId,
            standardId: values.standardId,
            sectionId: values.sectionId,
            admissionDate: values.admissionDate,
            admissionType: values.admissionType,
          },
        },
      });
      toast.success(t('new.success'));
      draft.clearDraft();
      const id = result.data?.createStudent.id;
      if (id) {
        router.push(`/institute/people/students/${id}`);
      } else {
        router.push('/institute/people/students');
      }
    } catch (err) {
      const message = extractGraphQLError(err, t('new.errors.generic'));
      toast.error(t('new.errors.generic'), { description: message });
    }
  };

  const handleCancel = () => router.push('/institute/people/students');

  return (
    <Can I="create" a="Student" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <StudentCreateFormBody
            form={form}
            onSubmit={onSubmit}
            onCancel={handleCancel}
            draftHasDraft={draft.hasDraft}
            draftRestore={draft.restoreDraft}
            draftDiscard={draft.discardDraft}
          />
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">{t('accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}
