'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { i18nTextSchema, useFormatDate, useI18nField } from '@roviq/i18n';
import {
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
  Field,
  FieldGroup,
  FieldLabel,
  I18nInput,
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
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileDown,
  FileText,
  GraduationCap,
  History,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../../hooks/use-form-draft';
import {
  type StudentDetailNode,
  useStudent,
  useStudentAcademics,
  useStudentAudit,
  useStudentDocuments,
  useStudentGuardians,
  useStudentTCs,
  useUpdateStudent,
} from '../use-students';

/**
 * Social category options must match StudentFilterInput.socialCategory
 * (GENERAL/OBC/SC/ST/EWS) — used for compliance reporting (UDISE/RTE).
 */
const SOCIAL_CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as const;
const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

/** 10-status TC lifecycle — mirrors tc_register.status state machine. */
const TC_STATUS_CLASS: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  CLEARANCE_PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  CLEARED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  ISSUED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  COUNTERSIGNED: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  CANCELLED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  DUPLICATE_ISSUED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  RETURNED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
};

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('students');
  const { data, loading, error } = useStudent(params.id);
  const resolveI18nName = useI18nField();
  const student = data?.getStudent;
  useBreadcrumbOverride(
    student
      ? {
          [params.id]: [resolveI18nName(student.firstName), resolveI18nName(student.lastName)]
            .filter(Boolean)
            .join(' '),
        }
      : {},
  );

  if (loading && !data) {
    return <StudentDetailSkeleton />;
  }

  if (error || !student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/institute/people/students')}>
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

  return (
    <Can I="read" a="Student" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <StudentHeader
              student={student}
              onBack={() => router.push('/institute/people/students')}
            />

            <Tabs defaultValue="profile" className="space-y-4">
              <TabsList>
                <TabsTrigger value="profile">
                  <UserRound className="size-4" />
                  {t('detail.tabs.profile')}
                </TabsTrigger>
                <TabsTrigger value="academics">
                  <GraduationCap className="size-4" />
                  {t('detail.tabs.academics')}
                </TabsTrigger>
                <TabsTrigger value="guardians">
                  <Users className="size-4" />
                  {t('detail.tabs.guardians')}
                </TabsTrigger>
                <TabsTrigger value="documents">
                  <FileText className="size-4" />
                  {t('detail.tabs.documents')}
                </TabsTrigger>
                <TabsTrigger value="tc">
                  <ClipboardList className="size-4" />
                  {t('detail.tabs.tc')}
                </TabsTrigger>
                <TabsTrigger value="audit">
                  <History className="size-4" />
                  {t('detail.tabs.audit')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="profile">
                <ProfileTab student={student} />
              </TabsContent>
              <TabsContent value="academics">
                <AcademicsTab studentProfileId={student.id} />
              </TabsContent>
              <TabsContent value="guardians">
                <GuardiansTab studentProfileId={student.id} />
              </TabsContent>
              <TabsContent value="documents">
                <DocumentsTab studentProfileId={student.id} />
              </TabsContent>
              <TabsContent value="tc">
                <TCHistoryTab studentProfileId={student.id} />
              </TabsContent>
              <TabsContent value="audit">
                <AuditTab studentId={student.id} />
              </TabsContent>
            </Tabs>
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

// ─── Header card ──────────────────────────────────────────────────────────

function StudentHeader({ student, onBack }: { student: StudentDetailNode; onBack: () => void }) {
  const t = useTranslations('students');
  const resolveI18n = useI18nField();
  const fullName = [resolveI18n(student.firstName), resolveI18n(student.lastName)]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4" />
        {t('detail.back')}
      </Button>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-mono">{student.admissionNumber}</span>
            <span>·</span>
            <span>
              {t(`academicStatuses.${student.academicStatus}`, {
                default: student.academicStatus,
              })}
            </span>
            {student.isRteAdmitted && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                <ShieldCheck className="size-3" />
                {t('rte.yes')}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile tab (editable) ───────────────────────────────────────────────

/**
 * Zod schema for the editable subset of student profile fields. We only edit
 * fields that are semantically safe to change post-enrollment — admission
 * number, dates, and status transitions are NOT edited here (status changes
 * are named domain mutations per the entity-lifecycle rule).
 */
const profileSchema = z.object({
  firstName: i18nTextSchema,
  lastName: i18nTextSchema.optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  socialCategory: z.enum(['GENERAL', 'OBC', 'SC', 'ST', 'EWS']),
  bloodGroup: z.string().optional(),
  religion: z.string().optional(),
  caste: z.string().optional(),
  motherTongue: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileTab({ student }: { student: StudentDetailNode }) {
  const t = useTranslations('students');
  const { format } = useFormatDate();
  const [updateStudent, { loading }] = useUpdateStudent();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: student.firstName ?? { en: '' },
      lastName: student.lastName ?? undefined,
      gender: (student.gender as ProfileFormValues['gender']) ?? undefined,
      socialCategory: student.socialCategory as ProfileFormValues['socialCategory'],
      bloodGroup: student.bloodGroup ?? '',
      religion: student.religion ?? '',
      caste: student.caste ?? '',
      motherTongue: student.motherTongue ?? '',
    },
  });

  const draft = useFormDraft({
    key: `student-profile:${student.id}`,
    form,
    enabled: !loading,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateStudent({
        variables: {
          id: student.id,
          input: {
            firstName: values.firstName,
            lastName: values.lastName,
            gender: values.gender,
            socialCategory: values.socialCategory,
            bloodGroup: values.bloodGroup || undefined,
            religion: values.religion || undefined,
            caste: values.caste || undefined,
            motherTongue: values.motherTongue || undefined,
            version: student.version,
          },
        },
      });
      toast.success(t('detail.profile.saved'));
      form.reset(values);
      draft.clearDraft();
    } catch (err) {
      const message = (err as Error).message;
      if (message.toLowerCase().includes('version') || message.includes('CONCURRENT')) {
        toast.error(t('detail.profile.concurrencyError'));
      } else {
        toast.error(message);
      }
    }
  });

  const isDirty = form.formState.isDirty;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.profile.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          {draft.hasDraft && (
            <div className="mb-4 flex items-center justify-between rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  {t('detail.profile.draftFound')}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {t('detail.profile.draftFoundDescription')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={draft.discardDraft}>
                  {t('detail.profile.draftDiscard')}
                </Button>
                <Button size="sm" onClick={draft.restoreDraft}>
                  {t('detail.profile.draftRestore')}
                </Button>
              </div>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-6">
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <I18nInput<ProfileFormValues>
                name="firstName"
                label={t('detail.profile.firstName')}
              />
              <I18nInput<ProfileFormValues> name="lastName" label={t('detail.profile.lastName')} />
              <Field>
                <FieldLabel htmlFor="gender">{t('detail.profile.gender')}</FieldLabel>
                <Select
                  value={form.watch('gender') ?? ''}
                  onValueChange={(v) =>
                    form.setValue('gender', v as ProfileFormValues['gender'], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder={t('detail.profile.genderPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDERS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {t(`genders.${g}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="socialCategory">{t('detail.profile.category')}</FieldLabel>
                <Select
                  value={form.watch('socialCategory')}
                  onValueChange={(v) =>
                    form.setValue('socialCategory', v as ProfileFormValues['socialCategory'], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="socialCategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`socialCategories.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="bloodGroup">{t('detail.profile.bloodGroup')}</FieldLabel>
                <Input id="bloodGroup" {...form.register('bloodGroup')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="religion">{t('detail.profile.religion')}</FieldLabel>
                <Input id="religion" {...form.register('religion')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="caste">{t('detail.profile.caste')}</FieldLabel>
                <Input id="caste" {...form.register('caste')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="motherTongue">{t('detail.profile.motherTongue')}</FieldLabel>
                <Input id="motherTongue" {...form.register('motherTongue')} />
              </Field>
            </FieldGroup>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <div className="text-muted-foreground">{t('detail.profile.admittedOn')}</div>
                <div>{format(new Date(student.admissionDate), 'PP')}</div>
              </div>
              {student.dateOfBirth && (
                <div>
                  <div className="text-muted-foreground">{t('detail.profile.dateOfBirth')}</div>
                  <div>{format(new Date(student.dateOfBirth), 'PP')}</div>
                </div>
              )}
              <div>
                <div className="text-muted-foreground">{t('detail.profile.version')}</div>
                <div className="font-mono">v{student.version}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!isDirty || loading}
                onClick={() => form.reset()}
              >
                {t('detail.profile.reset')}
              </Button>
              <Can I="update" a="Student">
                <Button type="submit" disabled={!isDirty || loading}>
                  {loading ? t('detail.profile.saving') : t('detail.profile.save')}
                </Button>
              </Can>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  );
}

// ─── TC History tab ───────────────────────────────────────────────────────

function TCHistoryTab({ studentProfileId }: { studentProfileId: string }) {
  const t = useTranslations('students');
  const { format } = useFormatDate();
  const { data, loading } = useStudentTCs(studentProfileId);

  if (loading && !data) {
    return <TabSkeleton />;
  }

  const tcs = data?.listTCs ?? [];

  if (tcs.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardList />
          </EmptyMedia>
          <EmptyTitle>{t('detail.tc.empty')}</EmptyTitle>
          <EmptyDescription>{t('detail.tc.emptyDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {tcs.map((tc) => (
        <Card key={tc.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{tc.tcSerialNumber}</span>
                  {tc.isDuplicate && <Badge variant="outline">{t('detail.tc.duplicate')}</Badge>}
                  <Badge variant="secondary" className={TC_STATUS_CLASS[tc.status] ?? ''}>
                    {t(`detail.tc.statuses.${tc.status}`, { default: tc.status })}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{tc.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(tc.createdAt), 'PP')}
                </p>
              </div>
              {tc.pdfUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={tc.pdfUrl} target="_blank" rel="noopener noreferrer">
                    {t('detail.tc.downloadPdf')}
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Audit tab ────────────────────────────────────────────────────────────

function AuditTab({ studentId }: { studentId: string }) {
  const t = useTranslations('students');
  const { format } = useFormatDate();
  const { data, loading } = useStudentAudit(studentId);

  if (loading && !data) {
    return <TabSkeleton />;
  }

  const entries = data?.auditLogs.edges.map((e) => e.node) ?? [];

  if (entries.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>{t('detail.audit.empty')}</EmptyTitle>
          <EmptyDescription>{t('detail.audit.emptyDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{entry.actionType}</Badge>
                  <span className="font-medium text-sm">{entry.action}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {entry.actorName ?? entry.userName ?? entry.actorId}
                  {' · '}
                  {format(new Date(entry.createdAt), 'PPpp')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {data?.auditLogs.pageInfo.hasNextPage && (
        <p className="text-xs text-muted-foreground text-center">
          {t('detail.audit.truncated', { count: data.auditLogs.totalCount })}
        </p>
      )}
    </div>
  );
}

// ─── Academics tab ────────────────────────────────────────────────────────

function AcademicsTab({ studentProfileId }: { studentProfileId: string }) {
  const t = useTranslations('students');
  const { format } = useFormatDate();
  const { data, loading } = useStudentAcademics(studentProfileId);

  if (loading && !data) {
    return <TabSkeleton />;
  }

  const rows = data?.listStudentAcademics ?? [];

  if (rows.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GraduationCap />
          </EmptyMedia>
          <EmptyTitle>{t('detail.academics.empty')}</EmptyTitle>
          <EmptyDescription>{t('detail.academics.emptyDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className={`flex items-start justify-between gap-4 rounded-md border p-4 ${
              row.isCurrentYear ? 'border-emerald-300 bg-emerald-50/40' : ''
            }`}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{row.academicYearLabel}</span>
                {row.isCurrentYear && (
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                    <CheckCircle2 className="size-3" />
                    {t('detail.academics.currentYear')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {row.standardName ?? t('detail.academics.unknownStandard')}
                {row.sectionName ? ` · ${row.sectionName}` : ''}
                {row.rollNumber ? ` · ${t('detail.academics.roll')} ${row.rollNumber}` : ''}
              </p>
              {row.promotionStatus && (
                <Badge variant="secondary" className="text-xs">
                  {t(`academicStatuses.${row.promotionStatus.toUpperCase()}`, {
                    default: row.promotionStatus,
                  })}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(row.updatedAt), 'PP')}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Guardians tab ────────────────────────────────────────────────────────

function GuardiansTab({ studentProfileId }: { studentProfileId: string }) {
  const t = useTranslations('students');
  const resolveI18n = useI18nField();
  const { data, loading } = useStudentGuardians(studentProfileId);

  if (loading && !data) {
    return <TabSkeleton />;
  }

  const guardians = data?.listStudentGuardians ?? [];

  if (guardians.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>{t('detail.guardians.empty')}</EmptyTitle>
          <EmptyDescription>{t('detail.guardians.emptyDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {guardians.map((g) => {
        const fullName = [resolveI18n(g.firstName), resolveI18n(g.lastName)]
          .filter(Boolean)
          .join(' ');
        return (
          <Card key={g.linkId}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{fullName}</span>
                    {g.isPrimaryContact && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700">
                        <Star className="size-3" />
                        {t('detail.guardians.primary')}
                      </Badge>
                    )}
                    {g.isEmergencyContact && (
                      <Badge variant="outline" className="border-rose-300 text-rose-700">
                        {t('detail.guardians.emergency')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t(`detail.guardians.relationships.${g.relationship}`, {
                      default: g.relationship,
                    })}
                    {g.occupation ? ` · ${g.occupation}` : ''}
                    {g.organization ? ` (${g.organization})` : ''}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {g.canPickup && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        {t('detail.guardians.canPickup')}
                      </span>
                    )}
                    {g.livesWith && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        {t('detail.guardians.livesWith')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Documents tab ────────────────────────────────────────────────────────

function DocumentsTab({ studentProfileId }: { studentProfileId: string }) {
  const t = useTranslations('students');
  const { format } = useFormatDate();
  const { data, loading } = useStudentDocuments(studentProfileId);

  if (loading && !data) {
    return <TabSkeleton />;
  }

  const docs = data?.listStudentDocuments ?? [];

  if (docs.length === 0) {
    return (
      <Empty className="py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>{t('detail.documents.empty')}</EmptyTitle>
          <EmptyDescription>{t('detail.documents.emptyDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {docs.map((doc) => (
        <Card key={doc.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {t(`detail.documents.types.${doc.type}`, { default: doc.type })}
                  </span>
                  {doc.isVerified ? (
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                      <CheckCircle2 className="size-3" />
                      {t('detail.documents.verified')}
                    </Badge>
                  ) : doc.rejectionReason ? (
                    <Badge variant="outline" className="border-rose-300 text-rose-700">
                      <XCircle className="size-3" />
                      {t('detail.documents.rejected')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 text-amber-700">
                      {t('detail.documents.pending')}
                    </Badge>
                  )}
                </div>
                {doc.description && (
                  <p className="text-sm text-muted-foreground">{doc.description}</p>
                )}
                {doc.referenceNumber && (
                  <p className="text-xs font-mono text-muted-foreground">
                    {t('detail.documents.refNo')}: {doc.referenceNumber}
                  </p>
                )}
                {doc.rejectionReason && (
                  <p className="text-xs text-rose-700">{doc.rejectionReason}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {format(new Date(doc.createdAt), 'PP')}
                  {doc.expiryDate
                    ? ` · ${t('detail.documents.expires')} ${format(new Date(doc.expiryDate), 'PP')}`
                    : ''}
                </p>
              </div>
              {doc.fileUrls.length > 0 && (
                <div className="flex flex-col gap-1">
                  {doc.fileUrls.map((url, idx) => (
                    <Button key={url} variant="outline" size="sm" asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <FileDown className="size-3" />
                        {doc.fileUrls.length > 1
                          ? t('detail.documents.page', { n: idx + 1 })
                          : t('detail.documents.download')}
                      </a>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────

function StudentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
