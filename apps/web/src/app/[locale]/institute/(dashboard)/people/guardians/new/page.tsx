'use client';

import { GUARDIAN_EDUCATION_LEVEL_VALUES, GuardianEducationLevel } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { buildI18nTextSchema } from '@roviq/i18n';
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
import { useCreateGuardian } from '../use-guardians';

// ─── Canonical enum lists ─────────────────────────────────────────────────
const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

// ─── Schema ───────────────────────────────────────────────────────────────
//
// Built with TanStack Form v1 + Standard Schema. The form-level
// `validators.onChange` walks ZodIssue paths and attaches errors directly
// to matching `form.Field` entries — we rely on that for per-locale error
// surfacing inside <I18nInputTFLocaleField />.
//
// Empty-string → undefined coercion is done here at the schema boundary
// (same idiom used elsewhere in the codebase) so the submit payload is a
// clean `CreateGuardianInput` without manual cleanup in the handler.

// Zod 4's union-of-optionals idiom `.optional().or(z.literal('').transform(...))`
// does NOT work: the first union branch (string.optional) greedily accepts the
// empty string and the transform branch is never attempted. Use `z.preprocess`
// to normalise `''`/whitespace → `undefined` BEFORE the inner validator runs.
// This is the canonical pattern recommended in the Zod 4 docs.
function emptyStringToUndefined<T extends z.ZodType>(inner: T) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), inner);
}

function buildSchema(t: ReturnType<typeof useTranslations>) {
  const firstNameSchema = buildI18nTextSchema(t('new.errors.firstNameRequired'));
  const lastNameSchema = buildI18nTextSchema(t('new.errors.lastNameRequired'));
  return z.object({
    firstName: firstNameSchema,
    lastName: lastNameSchema.optional(),
    gender: z.enum(GENDERS).optional(),
    email: emptyStringToUndefined(z.string().email(t('new.errors.emailInvalid')).optional()),
    phone: emptyStringToUndefined(
      z
        .string()
        .regex(/^[6-9]\d{9}$/, t('new.errors.phoneInvalid'))
        .optional(),
    ),
    occupation: emptyStringToUndefined(z.string().max(100).optional()),
    organization: emptyStringToUndefined(z.string().max(100).optional()),
    // `educationLevel` is a constrained enum in `guardian_profiles` (see
    // the `chk_education_level` CHECK constraint). Validate against the
    // shared `GuardianEducationLevel` enum so the Select options, backend
    // DTO, and DB constraint cannot drift apart.
    educationLevel: z.enum(GuardianEducationLevel).optional(),
  });
}

// TanStack Form uses the **input** type of a Standard Schema (Zod) as its
// form-data generic. We alias `z.input<typeof schema>` so the form state,
// defaultValues, and validators stay perfectly in sync with the schema
// definition without having to hand-roll a parallel interface.
type GuardianSchema = ReturnType<typeof buildSchema>;
type GuardianFormValues = z.input<GuardianSchema>;

const DRAFT_KEY = 'roviq:draft:guardians:new';

function loadDraft(): GuardianFormValues | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuardianFormValues;
  } catch {
    return null;
  }
}

function saveDraft(values: GuardianFormValues) {
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

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CreateGuardianPage() {
  const t = useTranslations('guardians');
  const router = useRouter();
  const [createGuardian] = useCreateGuardian();

  useBreadcrumbOverride({ new: t('new.title') });

  const schema = React.useMemo(() => buildSchema(t), [t]);

  // Detect a saved draft synchronously during the initial render so we can
  // show the restore banner immediately. We do NOT auto-apply — the user
  // must explicitly click Restore per [HUPGP]. The draft stays in
  // localStorage until the user submits or discards so a later navigation
  // can still offer it.
  const [pendingDraft, setPendingDraft] = React.useState<GuardianFormValues | null>(() =>
    loadDraft(),
  );

  const form = useForm({
    defaultValues: EMPTY_DEFAULTS,
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    // [HUPGP] Auto-save draft on every change, debounced 500ms.
    listeners: {
      onChange: ({ formApi }) => {
        saveDraft(formApi.state.values as GuardianFormValues);
      },
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      // The Zod schema already ran via `validators.onSubmit`; re-parse so
      // the submit handler works with the cleaned output shape (empty
      // strings coerced to undefined by the preprocess wrapper).
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
        if (id) {
          router.push(`/institute/people/guardians/${id}`);
        } else {
          router.push('/institute/people/guardians');
        }
      } catch (err) {
        const message = extractGraphQLError(err, t('new.errors.generic'));
        toast.error(t('new.errors.generic'), { description: message });
      }
    },
  });

  // Subscribe to submit state so the submit button can disable during
  // inflight mutation without re-rendering the whole page.
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    // Pass `keepDefaultValues: true` to work around TanStack/form#1798 —
    // without it the reset is reverted on the next render because the
    // form reconciles `defaultValues` and decides the reset was stale.
    form.reset(pendingDraft, { keepDefaultValues: true });
    setPendingDraft(null);
  };

  const discardDraft = () => {
    clearDraft();
    setPendingDraft(null);
  };

  const handleCancel = () => router.push('/institute/people/guardians');

  return (
    <Can I="create" a="Guardian" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 print:hidden">
              <div className="space-y-1">
                <h1 className="text-2xl font-bold tracking-tight">{t('new.title')}</h1>
                <p className="text-muted-foreground">{t('new.description')}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
                <ArrowLeft aria-hidden="true" className="size-4" />
                {t('new.back')}
              </Button>
            </div>

            {/* Draft restore banner */}
            {pendingDraft && (
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

            {/* Form */}
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
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
                        />
                      )}
                    </form.Field>
                    <form.Field name="firstName.hi">
                      {(field) => (
                        <I18nInputTFLocaleField
                          field={field}
                          locale="hi"
                          placeholder={t('new.placeholders.firstName')}
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
                        />
                      )}
                    </form.Field>
                    <form.Field name="lastName.hi">
                      {(field) => (
                        <I18nInputTFLocaleField
                          field={field}
                          locale="hi"
                          placeholder={t('new.placeholders.lastName')}
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
                            value={field.state.value ?? ''}
                            onValueChange={(v) =>
                              field.handleChange(
                                (v === '' ? undefined : v) as GuardianFormValues['gender'],
                              )
                            }
                          >
                            <SelectTrigger id={field.name} onBlur={field.handleBlur}>
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
                </FieldGroup>
              </FieldSet>

              {/* Contact section */}
              <FieldSet>
                <FieldLegend>{t('new.sections.contact')}</FieldLegend>
                <FieldGroup>
                  <form.Field name="email">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>{t('new.fields.email')}</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="email"
                            autoComplete="email"
                            placeholder={t('new.placeholders.email')}
                            value={(field.state.value ?? '') as string}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            aria-invalid={errorMessage ? true : undefined}
                          />
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
                              value={(field.state.value ?? '') as string}
                              onChange={(e) =>
                                field.handleChange(e.target.value.replace(/\D/g, ''))
                              }
                              onBlur={field.handleBlur}
                              aria-invalid={errorMessage ? true : undefined}
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
                </FieldGroup>
              </FieldSet>

              {/* Professional section */}
              <FieldSet>
                <FieldLegend>{t('new.sections.professional')}</FieldLegend>
                <FieldGroup>
                  <form.Field name="occupation">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>{t('new.fields.occupation')}</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            placeholder={t('new.placeholders.occupation')}
                            value={(field.state.value ?? '') as string}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                          />
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="organization">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>
                            {t('new.fields.organization')}
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            placeholder={t('new.placeholders.organization')}
                            value={(field.state.value ?? '') as string}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                          />
                          {errorMessage && <FieldError>{errorMessage}</FieldError>}
                        </Field>
                      );
                    }}
                  </form.Field>

                  <form.Field name="educationLevel">
                    {(field) => {
                      const errorMessage = firstFieldErrorMessage(field);
                      return (
                        <Field data-invalid={errorMessage ? true : undefined}>
                          <FieldLabel htmlFor={field.name}>
                            {t('new.fields.educationLevel')}
                          </FieldLabel>
                          <Select
                            value={field.state.value ?? ''}
                            onValueChange={(v) =>
                              field.handleChange(
                                (v === '' ? undefined : v) as GuardianFormValues['educationLevel'],
                              )
                            }
                          >
                            <SelectTrigger id={field.name} onBlur={field.handleBlur}>
                              <SelectValue placeholder={t('new.placeholders.educationLevel')} />
                            </SelectTrigger>
                            <SelectContent>
                              {GUARDIAN_EDUCATION_LEVEL_VALUES.map((level) => (
                                <SelectItem key={level} value={level}>
                                  {t(`new.educationLevels.${level}`)}
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

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-2 print:hidden">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  {t('new.cancel')}
                </Button>
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                  {isSubmitting ? t('new.submitting') : t('new.submit')}
                </Button>
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
