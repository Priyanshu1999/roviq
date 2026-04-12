'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { extractGraphQLError } from '@roviq/graphql';
import { i18nTextOptionalSchema, i18nTextSchema, useFormatDate } from '@roviq/i18n';
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
    firstName: i18nTextSchema,
    lastName: i18nTextOptionalSchema,
    email: z
      .string()
      .email(t('errors.emailInvalid'))
      .optional()
      .or(z.literal('').transform(() => undefined)),
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, t('errors.phoneInvalid'))
      .optional()
      .or(z.literal('').transform(() => undefined)),
    gender: z.enum(GENDERS).optional(),
    dateOfBirth: z
      .string()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    socialCategory: z.enum(SOCIAL_CATEGORIES).optional(),
    employeeId: z
      .string()
      .max(50)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    designation: z
      .string()
      .max(100)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    department: z
      .string()
      .max(100)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    dateOfJoining: z
      .string()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    specialization: z
      .string()
      .max(200)
      .optional()
      .or(z.literal('').transform(() => undefined)),
  });
}

type CreateStaffFormValues = z.infer<ReturnType<typeof buildSchema>>;

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Formats a 10-digit Indian mobile as `98765 43210` on blur. */
function formatIndianMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

// ─── Section: Personal ────────────────────────────────────────────────────

function PersonalSection() {
  const t = useTranslations('staff');
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<CreateStaffFormValues>();

  return (
    <FieldSet>
      <FieldLegend>{t('new.sections.personal')}</FieldLegend>
      <FieldGroup>
        <I18nInput<CreateStaffFormValues>
          name="firstName"
          label={t('new.fields.firstName')}
          placeholder={t('new.placeholders.firstName')}
          testId="staff-first-name"
        />
        <I18nInput<CreateStaffFormValues>
          name="lastName"
          label={t('new.fields.lastName')}
          placeholder={t('new.placeholders.lastName')}
          testId="staff-last-name"
        />
        <Field data-invalid={errors.gender ? true : undefined}>
          <FieldLabel htmlFor="gender">{t('new.fields.gender')}</FieldLabel>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="gender" data-test-id="staff-new-gender-select">
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

// ─── Section: Contact ─────────────────────────────────────────────────────

function ContactSection() {
  const t = useTranslations('staff');
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<CreateStaffFormValues>();

  return (
    <FieldSet>
      <FieldLegend>{t('new.sections.contact')}</FieldLegend>
      <FieldGroup>
        <Field data-invalid={errors.email ? true : undefined}>
          <FieldLabel htmlFor="email">{t('new.fields.email')}</FieldLabel>
          <Input
            id="email"
            data-test-id="staff-new-email-input"
            type="email"
            autoComplete="email"
            placeholder={t('new.placeholders.email')}
            {...register('email')}
          />
          {errors.email && <FieldError>{errors.email.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.phone ? true : undefined}>
          <FieldLabel htmlFor="phone">{t('new.fields.phone')}</FieldLabel>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground" aria-hidden="true">
              +91
            </span>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  id="phone"
                  data-test-id="staff-new-phone-input"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t('new.placeholders.phone')}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    field.onChange(digits);
                    e.target.value = formatIndianMobile(digits);
                    field.onBlur();
                  }}
                />
              )}
            />
          </div>
          <FieldDescription>{t('new.fieldDescriptions.phoneFormat')}</FieldDescription>
          {errors.phone && <FieldError>{errors.phone.message}</FieldError>}
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ─── Section: Employment ──────────────────────────────────────────────────

function EmploymentSection() {
  const t = useTranslations('staff');
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<CreateStaffFormValues>();

  return (
    <FieldSet>
      <FieldLegend>{t('new.sections.employment')}</FieldLegend>
      <FieldGroup>
        <Field data-invalid={errors.employeeId ? true : undefined}>
          <FieldLabel htmlFor="employeeId">{t('new.fields.employeeId')}</FieldLabel>
          <Input
            id="employeeId"
            placeholder={t('new.placeholders.employeeId')}
            {...register('employeeId')}
          />
          {errors.employeeId && <FieldError>{errors.employeeId.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.designation ? true : undefined}>
          <FieldLabel htmlFor="designation">{t('new.fields.designation')}</FieldLabel>
          <Input
            id="designation"
            data-test-id="staff-new-designation-input"
            placeholder={t('new.placeholders.designation')}
            {...register('designation')}
          />
          {errors.designation && <FieldError>{errors.designation.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.department ? true : undefined}>
          <FieldLabel htmlFor="department">{t('new.fields.department')}</FieldLabel>
          <Input
            id="department"
            data-test-id="staff-new-department-input"
            placeholder={t('new.placeholders.department')}
            {...register('department')}
          />
          {errors.department && <FieldError>{errors.department.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.employmentType ? true : undefined}>
          <FieldLabel htmlFor="employmentType">{t('new.fields.employmentType')}</FieldLabel>
          <Controller
            control={control}
            name="employmentType"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="employmentType" data-test-id="staff-new-employment-type-select">
                  <SelectValue placeholder={t('new.placeholders.employmentType')} />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {t(`new.employmentTypes.${e}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.employmentType && <FieldError>{errors.employmentType.message}</FieldError>}
        </Field>
        <Field data-invalid={errors.dateOfJoining ? true : undefined}>
          <FieldLabel htmlFor="dateOfJoining">{t('new.fields.dateOfJoining')}</FieldLabel>
          <Input id="dateOfJoining" type="date" {...register('dateOfJoining')} />
          <FieldDescription>{t('new.fieldDescriptions.dateFormat')}</FieldDescription>
          {errors.dateOfJoining && <FieldError>{errors.dateOfJoining.message}</FieldError>}
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

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
        <h1 data-test-id="staff-new-title" className="text-2xl font-bold tracking-tight">
          {t('new.title')}
        </h1>
        <p className="text-muted-foreground">{t('new.description')}</p>
      </div>
      <Button
        data-test-id="staff-new-back-btn"
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

function PageFooterActions({
  onCancel,
  isSubmitting,
}: {
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const t = useTranslations('staff');
  return (
    <div className="flex items-center justify-end gap-2 print:hidden">
      <Button
        data-test-id="staff-new-cancel-btn"
        type="button"
        variant="outline"
        onClick={onCancel}
      >
        {t('new.cancel')}
      </Button>
      <Button data-test-id="staff-new-submit-btn" type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {isSubmitting ? t('new.submitting') : t('new.submit')}
      </Button>
    </div>
  );
}

// ─── Form body ────────────────────────────────────────────────────────────

function StaffCreateFormBody({
  form,
  onSubmit,
  onCancel,
  draftHasDraft,
  draftRestore,
  draftDiscard,
}: {
  form: UseFormReturn<CreateStaffFormValues>;
  onSubmit: (values: CreateStaffFormValues) => Promise<void>;
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
          <ContactSection />
          <EmploymentSection />
          <PageFooterActions onCancel={onCancel} isSubmitting={isSubmitting} />
        </form>
      </FormProvider>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CreateStaffPage() {
  const t = useTranslations('staff');
  const router = useRouter();
  // formatDistance is kept available for future draft timestamp display;
  // we don't surface it in the current banner copy because we don't yet
  // have a reliable "saved at" to compare against without reading the
  // raw draft from localStorage.
  useFormatDate();
  const [createStaffMember] = useCreateStaffMember();

  useBreadcrumbOverride({ new: t('new.title') });

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const defaultValues: CreateStaffFormValues = React.useMemo(
    () => ({
      firstName: { en: '', hi: '' },
      lastName: undefined,
      email: undefined,
      phone: undefined,
      gender: undefined,
      dateOfBirth: undefined,
      socialCategory: undefined,
      employeeId: undefined,
      designation: undefined,
      department: undefined,
      employmentType: undefined,
      dateOfJoining: undefined,
      specialization: undefined,
    }),
    [],
  );

  const form = useForm<CreateStaffFormValues>({
    resolver: zodResolver(schema) as Resolver<CreateStaffFormValues>,
    defaultValues,
    mode: 'onBlur',
  });

  const draft = useFormDraft<CreateStaffFormValues>({
    key: 'staff:new',
    form,
    enabled: !form.formState.isSubmitting,
  });

  const onSubmit = async (values: CreateStaffFormValues) => {
    try {
      const result = await createStaffMember({
        variables: {
          input: {
            firstName: values.firstName,
            lastName: values.lastName,
            gender: values.gender,
            dateOfBirth: values.dateOfBirth || undefined,
            email: values.email,
            phone: values.phone ? values.phone.replace(/\D/g, '') : undefined,
            designation: values.designation,
            department: values.department,
            dateOfJoining: values.dateOfJoining || undefined,
            employmentType: values.employmentType,
            specialization: values.specialization,
          },
        },
      });
      toast.success(t('new.success'));
      draft.clearDraft();
      const id = result.data?.createStaffMember.id;
      if (id) {
        router.push(`/institute/people/staff/${id}`);
      } else {
        router.push('/institute/people/staff');
      }
    } catch (err) {
      const message = extractGraphQLError(err, t('new.errors.generic'));
      if (message.includes('DUPLICATE') || message.includes('already exists')) {
        form.setError('email', { message: t('new.errors.duplicate') });
        toast.error(t('new.errors.duplicate'));
      } else {
        toast.error(t('new.errors.generic'), { description: message });
      }
    }
  };

  const handleCancel = () => router.push('/institute/people/staff');

  return (
    <Can I="create" a="Staff" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <StaffCreateFormBody
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
