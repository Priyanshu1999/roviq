'use client';

import { ADMISSION_TYPE_VALUES } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { buildI18nTextSchema, useI18nField } from '@roviq/i18n';
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
  I18nInputTF,
  I18nInputTFLocaleField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useBreadcrumbOverride,
} from '@roviq/ui';
import type { AnyFieldApi } from '@tanstack/react-form';
import { useForm, useStore } from '@tanstack/react-form';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useAcademicYearsForStudents,
  useCreateStudent,
  useSectionsForStandard,
  useStandardsForYear,
} from '../use-students';

// ─── Canonical enum lists (mirror backend validators) ────────────────────
const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
const SOCIAL_CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as const;

// ─── Zod preprocess helper ───────────────────────────────────────────────
//
// Normalise `""` / whitespace → `undefined` BEFORE the inner validator runs
// so un-filled HTML inputs (native `<input type="date">`, optional phone,
// etc.) don't hit the backend as empty strings. The backend
// `@IsDateString`/`@IsPhoneNumber`/`@IsEmail` decorators reject `""`
// outright, producing silent form submit failures with `BadRequestException`.
// This is the canonical Zod 4 pattern; replaces the earlier dead
// `.or(z.literal('').transform(...))` branches which never fired because
// `.string().optional()` already matched `""`.
function emptyStringToUndefined<T extends z.ZodType>(inner: T) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), inner);
}

// ─── Schema ──────────────────────────────────────────────────────────────

function buildSchema(t: ReturnType<typeof useTranslations>) {
  const firstNameSchema = buildI18nTextSchema(t('new.errors.firstNameRequired'));
  const lastNameSchema = buildI18nTextSchema(t('new.errors.lastNameRequired'));
  return z.object({
    firstName: firstNameSchema,
    lastName: lastNameSchema.optional(),
    gender: emptyStringToUndefined(z.enum(GENDERS).optional()),
    dateOfBirth: emptyStringToUndefined(
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')
        .optional(),
    ),
    phone: emptyStringToUndefined(
      z
        .string()
        .regex(/^[6-9]\d{9}$/, t('new.errors.phoneInvalid'))
        .optional(),
    ),
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

// TanStack Form uses the **input** type of a Standard Schema (Zod) as its
// form-data generic, identical to the guardian create page.
type StudentSchema = ReturnType<typeof buildSchema>;
type StudentFormValues = z.input<StudentSchema>;

// ─── localStorage draft helpers ──────────────────────────────────────────

const DRAFT_KEY = 'roviq:draft:students:new';

function loadDraft(): StudentFormValues | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudentFormValues;
  } catch {
    return null;
  }
}

function saveDraft(values: StudentFormValues) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(values));
  } catch {
    // Quota exceeded or private mode — silently ignore.
  }
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // no-op
  }
}

// ─── Field error helper ──────────────────────────────────────────────────

function firstFieldErrorMessage(field: AnyFieldApi): string | null {
  if (!field.state.meta.isTouched) return null;
  for (const err of field.state.meta.errors) {
    if (err == null) continue;
    if (typeof err === 'string') return err;
    if (typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
      return err.message;
    }
  }
  return null;
}

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

// ─── Draft banner ────────────────────────────────────────────────────────

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

// ─── Page ────────────────────────────────────────────────────────────────

export default function CreateStudentPage() {
  const t = useTranslations('students');
  const resolveI18n = useI18nField();
  const router = useRouter();
  const [createStudent] = useCreateStudent();

  useBreadcrumbOverride({ new: t('new.title') });

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const [pendingDraft, setPendingDraft] = React.useState<StudentFormValues | null>(() =>
    loadDraft(),
  );

  const form = useForm({
    defaultValues: EMPTY_DEFAULTS,
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    // [HUPGP] Auto-save draft on every change, debounced 500ms — mirrors
    // the guardian create page pattern.
    listeners: {
      onChange: ({ formApi }) => {
        saveDraft(formApi.state.values as StudentFormValues);
      },
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      // The Zod schema already ran via `validators.onSubmit`; re-parse so
      // the submit handler works with the cleaned output shape (empty
      // strings coerced to undefined by the preprocess wrapper).
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
        if (id) {
          router.push(`/institute/people/students/${id}`);
        } else {
          router.push('/institute/people/students');
        }
      } catch (err) {
        const message = extractGraphQLError(err, t('new.errors.generic'));
        toast.error(t('new.errors.generic'), { description: message });
      }
    },
  });

  // Subscribe to submit state for the submit button + cascading-dropdown
  // dependencies so the child Selects re-render when their parent field
  // changes (TanStack Form's nested `form.Field` render props can't read
  // sibling field state without useStore).
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
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

  // Default to the active academic year once loaded. Runs exactly once per
  // page mount because of the `academicYearId === ''` guard — restoring a
  // draft that already has a year selected is a no-op.
  React.useEffect(() => {
    if (!academicYearId && activeYear) {
      form.setFieldValue('academicYearId', activeYear.id);
    }
  }, [academicYearId, activeYear, form]);

  const { data: standardsData, loading: standardsLoading } = useStandardsForYear(academicYearId);
  const standards = standardsData?.standards ?? [];

  const { data: sectionsData, loading: sectionsLoading } = useSectionsForStandard(standardId);
  const sections = sectionsData?.sections ?? [];

  const hasDraft = pendingDraft !== null;

  // Pass `keepDefaultValues: true` to work around TanStack/form#1798 —
  // without it the reset is reverted on the next render because the form
  // reconciles `defaultValues` and decides the reset was stale.
  const restoreDraft = () => {
    if (!pendingDraft) return;
    form.reset(pendingDraft, { keepDefaultValues: true });
    setPendingDraft(null);
  };

  const discardDraft = () => {
    clearDraft();
    setPendingDraft(null);
  };

  const handleCancel = () => router.push('/institute/people/students');

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
              {/* Personal section */}
              <FieldSet>
                <FieldLegend>{t('new.sections.personal')}</FieldLegend>
                <FieldGroup>
                  <I18nInputTF label={t('new.fields.firstName')}>
                    <form.Field name="firstName.en">
                      {(field) => (
                        <I18nInputTFLocaleField
                          field={field}
                          locale="en"
                          placeholder={t('new.placeholders.firstName')}
                          parentLabel={t('new.fields.firstName')}
                          testId="students-new-first-name"
                        />
                      )}
                    </form.Field>
                    <form.Field name="firstName.hi">
                      {(field) => (
                        <I18nInputTFLocaleField
                          field={field}
                          locale="hi"
                          placeholder={t('new.placeholders.firstName')}
                          parentLabel={t('new.fields.firstName')}
                          testId="students-new-first-name"
                        />
                      )}
                    </form.Field>
                  </I18nInputTF>

                  <I18nInputTF label={t('new.fields.lastName')}>
                    <form.Field name="lastName.en">
                      {(field) => (
                        <I18nInputTFLocaleField
                          field={field}
                          locale="en"
                          placeholder={t('new.placeholders.lastName')}
                          parentLabel={t('new.fields.lastName')}
                        />
                      )}
                    </form.Field>
                    <form.Field name="lastName.hi">
                      {(field) => (
                        <I18nInputTFLocaleField
                          field={field}
                          locale="hi"
                          placeholder={t('new.placeholders.lastName')}
                          parentLabel={t('new.fields.lastName')}
                        />
                      )}
                    </form.Field>
                  </I18nInputTF>

                  <form.Field name="gender">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>{t('new.fields.gender')}</FieldLabel>
                          <Select
                            value={(field.state.value as string | undefined) ?? ''}
                            onValueChange={(v) =>
                              field.handleChange(
                                v === '' ? undefined : (v as (typeof GENDERS)[number]),
                              )
                            }
                          >
                            <SelectTrigger
                              id={field.name}
                              data-testid="students-new-gender-select"
                              onBlur={field.handleBlur}
                            >
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
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="dateOfBirth">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>
                            {t('new.fields.dateOfBirth')}
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="date"
                            value={(field.state.value as string | undefined) ?? ''}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                          />
                          <FieldDescription>
                            {t('new.fieldDescriptions.dateFormat')}
                          </FieldDescription>
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="phone">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>{t('new.fields.phone')}</FieldLabel>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground" aria-hidden="true">
                              +91
                            </span>
                            <Input
                              id={field.name}
                              name={field.name}
                              inputMode="tel"
                              autoComplete="tel"
                              placeholder={t('new.placeholders.phone')}
                              value={(field.state.value as string | undefined) ?? ''}
                              onChange={(e) => field.handleChange(e.target.value)}
                              onBlur={field.handleBlur}
                            />
                          </div>
                          <FieldDescription>
                            {t('new.fieldDescriptions.phoneFormat')}
                          </FieldDescription>
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="socialCategory">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>
                            {t('new.fields.socialCategory')}
                          </FieldLabel>
                          <Select
                            value={(field.state.value as string | undefined) ?? ''}
                            onValueChange={(v) =>
                              field.handleChange(
                                v === '' ? undefined : (v as (typeof SOCIAL_CATEGORIES)[number]),
                              )
                            }
                          >
                            <SelectTrigger id={field.name} onBlur={field.handleBlur}>
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
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>
                </FieldGroup>
              </FieldSet>

              {/* Admission & enrollment section */}
              <FieldSet>
                <FieldLegend>{t('new.sections.admission')}</FieldLegend>
                <FieldGroup>
                  <form.Field name="academicYearId">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>
                            {t('new.fields.academicYear')}
                          </FieldLabel>
                          <Select
                            value={(field.state.value as string | undefined) ?? ''}
                            onValueChange={(v) => {
                              field.handleChange(v);
                              // Reset dependent selections whenever the year changes.
                              form.setFieldValue('standardId', '');
                              form.setFieldValue('sectionId', '');
                            }}
                            disabled={yearsLoading}
                          >
                            <SelectTrigger id={field.name} onBlur={field.handleBlur}>
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
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="standardId">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>{t('new.fields.standard')}</FieldLabel>
                          <Select
                            value={(field.state.value as string | undefined) ?? ''}
                            onValueChange={(v) => {
                              field.handleChange(v);
                              form.setFieldValue('sectionId', '');
                            }}
                            disabled={!academicYearId || standardsLoading || standards.length === 0}
                          >
                            <SelectTrigger
                              id={field.name}
                              data-testid="students-new-standard-select"
                              onBlur={field.handleBlur}
                            >
                              <SelectValue placeholder={t('new.placeholders.standard')} />
                            </SelectTrigger>
                            <SelectContent>
                              {standards.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {resolveI18n(s.name)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="sectionId">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>{t('new.fields.section')}</FieldLabel>
                          <Select
                            value={(field.state.value as string | undefined) ?? ''}
                            onValueChange={(v) => field.handleChange(v)}
                            disabled={!standardId || sectionsLoading || sections.length === 0}
                          >
                            <SelectTrigger
                              id={field.name}
                              data-testid="students-new-section-select"
                              onBlur={field.handleBlur}
                            >
                              <SelectValue placeholder={t('new.placeholders.section')} />
                            </SelectTrigger>
                            <SelectContent>
                              {sections.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.displayLabel ?? resolveI18n(s.name)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="admissionDate">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>
                            {t('new.fields.admissionDate')}
                          </FieldLabel>
                          <Input
                            id={field.name}
                            data-testid="students-new-admission-date-input"
                            name={field.name}
                            type="date"
                            value={(field.state.value as string | undefined) ?? ''}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                          />
                          <FieldDescription>
                            {t('new.fieldDescriptions.dateFormat')}
                          </FieldDescription>
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="admissionType">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>
                            {t('new.fields.admissionType')}
                          </FieldLabel>
                          <Select
                            value={(field.state.value as string | undefined) ?? ''}
                            onValueChange={(v) =>
                              field.handleChange(
                                v === ''
                                  ? undefined
                                  : (v as (typeof ADMISSION_TYPE_VALUES)[number]),
                              )
                            }
                          >
                            <SelectTrigger id={field.name} onBlur={field.handleBlur}>
                              <SelectValue placeholder={t('new.placeholders.admissionType')} />
                            </SelectTrigger>
                            <SelectContent>
                              {ADMISSION_TYPE_VALUES.map((a) => (
                                <SelectItem key={a} value={a}>
                                  {t(`new.admissionTypes.${a}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>
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
                <Button data-testid="students-new-submit-btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                  {isSubmitting ? t('new.submitting') : t('new.submit')}
                </Button>
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
