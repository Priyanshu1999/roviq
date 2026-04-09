'use client';

import { GUARDIAN_EDUCATION_LEVEL_VALUES, GuardianEducationLevel } from '@roviq/common-types';
import { buildI18nTextSchema, useFormatDate, useI18nField } from '@roviq/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EntityTimeline,
  Field,
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
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useBreadcrumbOverride,
} from '@roviq/ui';
import type { AnyFieldApi } from '@tanstack/react-form';
import { useForm, useStore } from '@tanstack/react-form';
import { AlertTriangle, ArrowLeft, History, UserRound, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  type GuardianDetailNode,
  type LinkedStudentNode,
  useConsentStatusForStudent,
  useGuardian,
  useGuardianLinkedStudents,
  useUpdateGuardian,
} from '../use-guardians';

/**
 * DPDP Act 2023 consent purposes — mirrors the `chk_consent_purpose` check
 * constraint on `consent_records`. Listed in a stable display order so the
 * per-child mini-badge grid is deterministic across renders. Keep in sync
 * with the backend enum check if/when a new purpose is added.
 */
const DPDP_CONSENT_PURPOSES = [
  'academic_data_processing',
  'photo_video_marketing',
  'whatsapp_communication',
  'sms_communication',
  'aadhaar_collection',
  'biometric_collection',
  'third_party_edtech',
  'board_exam_registration',
  'transport_tracking',
  'health_data_processing',
  'cctv_monitoring',
] as const;

// Zod-4 preprocess wrapper — normalises `""` / whitespace → `undefined` BEFORE
// the inner validator runs, so un-filled HTML inputs don't hit the backend
// as empty strings. Mirrors the identical helper in the guardian CREATE page.
function emptyStringToUndefined<T extends z.ZodTypeAny>(inner: T) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), inner);
}

function buildGuardianProfileSchema(t: ReturnType<typeof useTranslations>) {
  const firstNameSchema = buildI18nTextSchema(t('new.errors.firstNameRequired'));
  const lastNameSchema = buildI18nTextSchema(t('new.errors.lastNameRequired'));
  return z.object({
    firstName: firstNameSchema,
    lastName: lastNameSchema.optional(),
    occupation: emptyStringToUndefined(z.string().max(100).optional()),
    organization: emptyStringToUndefined(z.string().max(100).optional()),
    designation: emptyStringToUndefined(z.string().max(100).optional()),
    // Constrained to the 6 `GuardianEducationLevel` pgEnum members — the
    // single source of truth lives in `@roviq/common-types`. Zod 4 accepts
    // the const-object alias as a native-enum input and emits the literal
    // union in its parsed output type.
    educationLevel: z.enum(GuardianEducationLevel).optional(),
  });
}

// TanStack Form uses the **input** type of a Standard Schema (Zod) as its
// form-data generic, identical to the create page.
type GuardianProfileSchema = ReturnType<typeof buildGuardianProfileSchema>;
type GuardianProfileFormValues = z.input<GuardianProfileSchema>;

// ─── Draft auto-save helpers (localStorage, TanStack listeners.onChange) ──

function buildDraftKey(guardianId: string): string {
  return `roviq:draft:guardian-profile:${guardianId}`;
}

function loadDraft(guardianId: string): GuardianProfileFormValues | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(buildDraftKey(guardianId));
    if (!raw) return null;
    return JSON.parse(raw) as GuardianProfileFormValues;
  } catch {
    return null;
  }
}

function saveDraft(guardianId: string, values: GuardianProfileFormValues) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(buildDraftKey(guardianId), JSON.stringify(values));
  } catch {
    // Quota exceeded or private mode — silently ignore.
  }
}

function clearDraft(guardianId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(buildDraftKey(guardianId));
  } catch {
    // no-op
  }
}

// Pull the first user-visible error from a TanStack field when it's been
// touched. Mirrors the create-page helper.
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

export default function GuardianDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('guardians');
  const resolveI18nName = useI18nField();
  const { format: formatDate } = useFormatDate();
  const { data, loading, error, refetch } = useGuardian(params.id);
  const guardian = data?.getGuardian;

  useBreadcrumbOverride(
    guardian
      ? {
          [params.id]: [resolveI18nName(guardian.firstName), resolveI18nName(guardian.lastName)]
            .filter(Boolean)
            .join(' '),
        }
      : {},
  );

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-40" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !guardian) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/institute/people/guardians')}
        >
          <ArrowLeft className="size-4" />
          {t('detail.back')}
        </Button>
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle>{t('detail.notFound')}</EmptyTitle>
            <EmptyDescription>{t('detail.notFoundDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const fullName = [resolveI18nName(guardian.firstName), resolveI18nName(guardian.lastName)]
    .filter(Boolean)
    .join(' ');
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Can I="read" a="Guardian" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between print:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/institute/people/guardians')}
              >
                <ArrowLeft className="size-4" />
                {t('detail.back')}
              </Button>
              <div className="text-xs text-muted-foreground">
                {formatDate(new Date(guardian.updatedAt), 'date-medium')}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              <GuardianSidebar guardian={guardian} fullName={fullName} initials={initials} />
              <div className="min-w-0">
                <Tabs defaultValue="profile" className="w-full">
                  <TabsList>
                    <TabsTrigger value="profile">
                      <UserRound className="size-4" />
                      {t('detail.tabs.profile')}
                    </TabsTrigger>
                    <TabsTrigger value="children">
                      <Users className="size-4" />
                      {t('detail.tabs.children')}
                    </TabsTrigger>
                    <TabsTrigger value="audit">
                      <History className="size-4" />
                      {t('detail.tabs.audit')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="profile" className="mt-4">
                    <GuardianProfileTab guardian={guardian} loading={loading} onRefetch={refetch} />
                  </TabsContent>

                  <TabsContent value="children" className="mt-4">
                    <GuardianChildrenTab guardianId={guardian.id} />
                  </TabsContent>

                  <TabsContent value="audit" className="mt-4">
                    <Card>
                      <CardContent className="pt-6">
                        <EntityTimeline entityType="Guardian" entityId={guardian.id} />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </div>
        ) : (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertTriangle />
              </EmptyMedia>
              <EmptyTitle>{t('accessDenied')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )
      }
    </Can>
  );
}

function GuardianSidebar({
  guardian,
  fullName,
  initials,
}: {
  guardian: GuardianDetailNode;
  fullName: string;
  initials: string;
}) {
  const t = useTranslations('guardians');
  const { data } = useGuardianLinkedStudents(guardian.id);
  const linked = data?.listLinkedStudents ?? [];
  const primaryCount = linked.filter((s) => s.isPrimaryContact).length;

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start print:hidden">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <Avatar className="size-24">
            {guardian.profileImageUrl ? (
              <AvatarImage src={guardian.profileImageUrl} alt={fullName} />
            ) : null}
            <AvatarFallback>{initials || '?'}</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-lg font-semibold">{fullName}</div>
            {guardian.occupation ? (
              <div className="text-sm text-muted-foreground">{guardian.occupation}</div>
            ) : null}
          </div>
          <Separator />
          <div className="w-full text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                <Users className="mr-1 inline size-3.5" />
                {t('detail.sidebar.primaryFor', { count: primaryCount })}
              </span>
              <Badge variant="secondary">{primaryCount}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

function GuardianProfileTab({
  guardian,
  loading,
  onRefetch,
}: {
  guardian: GuardianDetailNode;
  loading: boolean;
  onRefetch: () => void;
}) {
  const t = useTranslations('guardians');
  const [updateGuardian, { loading: saving }] = useUpdateGuardian();
  const schema = React.useMemo(() => buildGuardianProfileSchema(t), [t]);

  // Normalise server-returned i18n text into the shape TanStack's
  // `form.Field name="firstName.hi"` expects — every locale key must be a
  // string (not undefined), otherwise the Zod `i18nTextSchema` refine throws
  // at submit time. The backend returns `Record<string, string>` but may
  // omit non-default locale keys, so we backfill `hi: ''` for the form only.
  const defaultValues: GuardianProfileFormValues = React.useMemo(
    () => ({
      firstName: { en: guardian.firstName.en ?? '', hi: guardian.firstName.hi ?? '' },
      lastName: guardian.lastName
        ? { en: guardian.lastName.en ?? '', hi: guardian.lastName.hi ?? '' }
        : undefined,
      occupation: guardian.occupation ?? '',
      organization: guardian.organization ?? '',
      designation: guardian.designation ?? '',
      educationLevel: guardian.educationLevel ?? undefined,
    }),
    [guardian],
  );

  const form = useForm({
    defaultValues,
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    // [HUPGP] Auto-save draft on every change, debounced 500ms — mirrors
    // the create page. Uses a bare `listeners.onChange` + localStorage so
    // the react-hook-form-specific `useFormDraft` hook can be retired.
    listeners: {
      onChange: ({ formApi }) => {
        if (loading) return;
        saveDraft(guardian.id, formApi.state.values as GuardianProfileFormValues);
      },
      onChangeDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      // Re-parse so the submit handler sees the preprocess-cleaned output
      // (empty strings coerced to undefined, etc.).
      const parsed = schema.parse(value);
      try {
        await updateGuardian({
          variables: {
            id: guardian.id,
            input: {
              occupation: parsed.occupation,
              organization: parsed.organization,
              designation: parsed.designation,
              educationLevel: parsed.educationLevel,
              // Version is optimistic-concurrency metadata — read from the
              // freshest Apollo-cached record so each submit races cleanly
              // against whatever version the server just returned.
              version: guardian.version,
            },
          },
        });
        toast.success(t('detail.profile.saved'));
        clearDraft(guardian.id);
        // Reset dirty flag so the Save button re-disables and the
        // `!isDirty` guard in the create-page pattern matches again.
        form.reset(value);
      } catch (err) {
        const message = (err as Error).message;
        if (message.toLowerCase().includes('version') || message.includes('CONCURRENT')) {
          toast.error(t('detail.profile.concurrencyError'), {
            action: {
              label: t('detail.profile.refresh'),
              onClick: () => onRefetch(),
            },
          });
        } else {
          toast.error(message);
        }
      }
    },
  });

  // Subscribe to submit state so the submit button can disable during
  // inflight mutation and when the form is pristine, without re-rendering
  // the whole tab on every keystroke.
  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  const isDirty = useStore(form.store, (state) => state.isDirty);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.tabs.profile')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-6"
        >
          <FieldSet>
            <FieldLegend>
              <UserRound className="size-4" />
              {t('detail.tabs.profile')}
            </FieldLegend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <I18nInputTF label={t('detail.profile.firstName')}>
                <form.Field name="firstName.en">
                  {(field) => <I18nInputTFLocaleField field={field} locale="en" />}
                </form.Field>
                <form.Field name="firstName.hi">
                  {(field) => <I18nInputTFLocaleField field={field} locale="hi" />}
                </form.Field>
              </I18nInputTF>

              <I18nInputTF label={t('detail.profile.lastName')}>
                <form.Field name="lastName.en">
                  {(field) => <I18nInputTFLocaleField field={field} locale="en" />}
                </form.Field>
                <form.Field name="lastName.hi">
                  {(field) => <I18nInputTFLocaleField field={field} locale="hi" />}
                </form.Field>
              </I18nInputTF>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>{t('detail.profile.occupation')}</FieldLegend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <form.Field name="occupation">
                {(field) => {
                  const errorMessage = firstFieldErrorMessage(field);
                  return (
                    <Field data-invalid={errorMessage ? true : undefined}>
                      <FieldLabel htmlFor={field.name}>{t('detail.profile.occupation')}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={(field.state.value as string | undefined) ?? ''}
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
                        {t('detail.profile.organization')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={(field.state.value as string | undefined) ?? ''}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      {errorMessage && <FieldError>{errorMessage}</FieldError>}
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field name="designation">
                {(field) => {
                  const errorMessage = firstFieldErrorMessage(field);
                  return (
                    <Field data-invalid={errorMessage ? true : undefined}>
                      <FieldLabel htmlFor={field.name}>
                        {t('detail.profile.designation')}
                      </FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={(field.state.value as string | undefined) ?? ''}
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
                        {t('detail.profile.educationLevel')}
                      </FieldLabel>
                      <Select
                        value={(field.state.value as string | undefined) ?? ''}
                        onValueChange={(v) =>
                          field.handleChange(v === '' ? undefined : (v as GuardianEducationLevel))
                        }
                      >
                        <SelectTrigger id={field.name} onBlur={field.handleBlur}>
                          <SelectValue placeholder={t('new.placeholders.educationLevel')} />
                        </SelectTrigger>
                        <SelectContent>
                          {GUARDIAN_EDUCATION_LEVEL_VALUES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(`new.educationLevels.${value}`)}
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

          <div className="flex items-center justify-end gap-2">
            <Button type="submit" disabled={!canSubmit || isSubmitting || saving || !isDirty}>
              {isSubmitting || saving ? t('detail.profile.saving') : t('detail.profile.save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function GuardianChildrenTab({ guardianId }: { guardianId: string }) {
  const t = useTranslations('guardians');
  const resolveI18nName = useI18nField();
  const { data, loading } = useGuardianLinkedStudents(guardianId);
  const linked = data?.listLinkedStudents ?? [];

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (linked.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>{t('detail.children.empty')}</EmptyTitle>
          <EmptyDescription>{t('detail.children.emptyDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {linked.map((child: LinkedStudentNode) => {
        const childName = [resolveI18nName(child.firstName), resolveI18nName(child.lastName)]
          .filter(Boolean)
          .join(' ');
        const placement = [
          child.currentStandardName ? resolveI18nName(child.currentStandardName) : '',
          child.currentSectionName ? resolveI18nName(child.currentSectionName) : '',
        ]
          .filter(Boolean)
          .join(' · ');
        const childInitials = childName
          .split(/\s+/)
          .filter(Boolean)
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        return (
          <Card key={child.linkId}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center gap-3">
                <Avatar className="size-12">
                  {child.profileImageUrl ? (
                    <AvatarImage src={child.profileImageUrl} alt={childName} />
                  ) : null}
                  <AvatarFallback>{childInitials || '?'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{childName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {child.admissionNumber}
                    {placement ? ` · ${placement}` : ''}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <Badge variant="outline">{child.relationship}</Badge>
                    {child.isPrimaryContact ? (
                      <Badge variant="secondary">{t('linkedChildren.primaryBadge')}</Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <ChildConsentSummary studentProfileId={child.studentProfileId} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Per-child consent mini-summary rendered inside each linked-child card on
 * the guardian detail page (ROV-169 Gap 4). Fetches the latest consent
 * state for every DPDP purpose for a single student and renders one small
 * badge per purpose — green when granted, grey when withdrawn/missing.
 * Also shows a compact "{granted}/{total} purposes granted" caption for
 * quick scanning of compliance status.
 */
function ChildConsentSummary({ studentProfileId }: { studentProfileId: string }) {
  const t = useTranslations('guardians');
  const { data, loading } = useConsentStatusForStudent(studentProfileId);

  if (loading && !data) {
    return <Skeleton className="h-6 w-full" />;
  }

  const records = data?.consentStatusForStudent ?? [];
  // Build a purpose → isGranted map; missing records default to false
  // ("not yet granted"), matching the backend's append-only model.
  const stateByPurpose = new Map<string, boolean>();
  for (const r of records) {
    stateByPurpose.set(r.purpose, r.isGranted);
  }
  const grantedCount = DPDP_CONSENT_PURPOSES.filter((p) => stateByPurpose.get(p) === true).length;

  return (
    <div className="border-t pt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {t('detail.children.consentTitle')}
        </span>
        <span className="text-xs text-muted-foreground">
          {t('detail.children.consentSummary', {
            granted: grantedCount,
            total: DPDP_CONSENT_PURPOSES.length,
          })}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {DPDP_CONSENT_PURPOSES.map((purpose) => {
          const granted = stateByPurpose.get(purpose) === true;
          const label = t(`consent.purposes.${purpose}`, { default: purpose });
          return (
            <Badge
              key={purpose}
              variant={granted ? 'default' : 'outline'}
              className={
                granted
                  ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-100'
                  : 'text-muted-foreground'
              }
              title={label}
            >
              <span className="max-w-[8ch] truncate text-[10px]">{label}</span>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
