'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { i18nTextSchema, useFormatDate, useI18nField } from '@roviq/i18n';
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
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  I18nInput,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useBreadcrumbOverride,
} from '@roviq/ui';
import { AlertTriangle, ArrowLeft, History, UserRound, Users } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../../hooks/use-form-draft';
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

const guardianProfileSchema = z.object({
  firstName: i18nTextSchema,
  lastName: i18nTextSchema.optional(),
  occupation: z.string().optional(),
  organization: z.string().optional(),
  designation: z.string().optional(),
  educationLevel: z.string().optional(),
  version: z.number(),
});

type GuardianProfileFormValues = z.infer<typeof guardianProfileSchema>;

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

  const form = useForm<GuardianProfileFormValues>({
    resolver: zodResolver(guardianProfileSchema),
    defaultValues: {
      firstName: guardian.firstName,
      lastName: guardian.lastName ?? undefined,
      occupation: guardian.occupation ?? '',
      organization: guardian.organization ?? '',
      designation: guardian.designation ?? '',
      educationLevel: guardian.educationLevel ?? '',
      version: guardian.version,
    },
  });

  const draft = useFormDraft({
    key: `guardian-profile:${guardian.id}`,
    form,
    enabled: !loading,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateGuardian({
        variables: {
          id: guardian.id,
          input: {
            occupation: values.occupation || undefined,
            organization: values.organization || undefined,
            designation: values.designation || undefined,
            educationLevel: values.educationLevel || undefined,
            version: guardian.version,
          },
        },
      });
      toast.success(t('detail.profile.saved'));
      form.reset(values);
      draft.clearDraft();
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
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.tabs.profile')}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="space-y-6">
            <FieldSet>
              <FieldLegend>
                <UserRound className="size-4" />
                {t('detail.tabs.profile')}
              </FieldLegend>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <I18nInput<GuardianProfileFormValues>
                  name="firstName"
                  label={t('detail.profile.firstName')}
                />
                <I18nInput<GuardianProfileFormValues>
                  name="lastName"
                  label={t('detail.profile.lastName')}
                />
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <FieldLegend>{t('detail.profile.occupation')}</FieldLegend>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="occupation">{t('detail.profile.occupation')}</FieldLabel>
                  <input
                    id="occupation"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    {...form.register('occupation')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="organization">{t('detail.profile.organization')}</FieldLabel>
                  <input
                    id="organization"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    {...form.register('organization')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="designation">{t('detail.profile.designation')}</FieldLabel>
                  <input
                    id="designation"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    {...form.register('designation')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="educationLevel">
                    {t('detail.profile.educationLevel')}
                  </FieldLabel>
                  <input
                    id="educationLevel"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    {...form.register('educationLevel')}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <div className="flex items-center justify-end gap-2">
              <Button type="submit" disabled={saving || !form.formState.isDirty}>
                {saving ? t('detail.profile.saving') : t('detail.profile.save')}
              </Button>
            </div>
          </form>
        </FormProvider>
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
