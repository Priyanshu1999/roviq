'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { gql, useMutation } from '@roviq/graphql';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EntityTimeline,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  I18nInput,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
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
  Info,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useState } from 'react';
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../../hooks/use-form-draft';
import {
  type StudentDetailNode,
  useStudent,
  useStudentAcademics,
  useStudentDocuments,
  useStudentGuardians,
  useStudentTCs,
  useUpdateStudent,
  useUploadStudentDocument,
} from '../use-students';

/**
 * Document types enforced by the `chk_document_type` CHECK constraint on
 * `user_documents.type`. Must stay in sync with the Zod enum and with the
 * `detail.documents.types.*` i18n keys.
 */
const DOCUMENT_TYPES = [
  'birth_certificate',
  'tc_incoming',
  'report_card',
  'aadhaar_card',
  'caste_certificate',
  'income_certificate',
  'ews_certificate',
  'medical_certificate',
  'disability_certificate',
  'address_proof',
  'passport_photo',
  'family_photo',
  'bpl_card',
  'transfer_order',
  'noc',
  'affidavit',
  'other',
] as const;

const uploadDocumentSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  description: z.string().max(255).optional(),
  fileUrlsRaw: z.string().min(1),
  referenceNumber: z.string().max(100).optional(),
});
type UploadDocumentForm = z.infer<typeof uploadDocumentSchema>;

/**
 * Fallback rendered when an ErrorBoundary around a student-detail tab catches
 * a runtime error. Isolates failures to the tab body so other tabs and the
 * page shell keep working. Implements rule [OPULR] from frontend-ux.
 */
function TabErrorFallback() {
  const t = useTranslations('students');
  const { resetBoundary } = useErrorBoundary();
  return (
    <Empty className="py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertTriangle aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t('detail.tabError')}</EmptyTitle>
        <EmptyDescription>{t('detail.tabErrorDescription')}</EmptyDescription>
      </EmptyHeader>
      <Button variant="outline" size="sm" onClick={resetBoundary}>
        {t('detail.tabRetry')}
      </Button>
    </Empty>
  );
}

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

/**
 * Frontend mirror of the backend state machine for `student_profiles.academic_status`.
 * Keys are the current status; values are the statuses the user may transition to.
 * Terminal/absorbing states map to an empty array. Kept in sync with
 * `StudentService.transitionStatus` guard logic.
 */
const STUDENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  ENROLLED: [
    'PROMOTED',
    'DETAINED',
    'GRADUATED',
    'TRANSFERRED_OUT',
    'DROPPED_OUT',
    'WITHDRAWN',
    'SUSPENDED',
    'EXPELLED',
  ],
  PROMOTED: ['ENROLLED'],
  DETAINED: ['ENROLLED'],
  SUSPENDED: ['ENROLLED', 'EXPELLED'],
  WITHDRAWN: ['ENROLLED'],
  TRANSFERRED_OUT: [],
  GRADUATED: ['PASSED_OUT'],
  EXPELLED: [],
  DROPPED_OUT: [],
  PASSED_OUT: [],
};

/**
 * Destructive transitions require a typed reason for audit traceability.
 * The backend also rejects these transitions without a reason, but the
 * frontend validates with Zod so users see the error before the mutation.
 */
const DESTRUCTIVE_TRANSITIONS = new Set([
  'WITHDRAWN',
  'DROPPED_OUT',
  'TRANSFERRED_OUT',
  'EXPELLED',
]);

const TRANSITION_STUDENT_STATUS = gql`
  mutation TransitionStudentStatus($id: ID!, $newStatus: String!, $reason: String) {
    transitionStudentStatus(id: $id, newStatus: $newStatus, reason: $reason) {
      id
      academicStatus
      version
    }
  }
`;

type TransitionStudentStatusData = {
  transitionStudentStatus: { id: string; academicStatus: string; version: number };
};

type TransitionStudentStatusVars = {
  id: string;
  newStatus: string;
  reason?: string;
};

function useTransitionStudentStatus() {
  return useMutation<TransitionStudentStatusData, TransitionStudentStatusVars>(
    TRANSITION_STUDENT_STATUS,
    { refetchQueries: ['InstituteStudent', 'InstituteStudents'] },
  );
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('students');
  const { data, loading, error, refetch } = useStudent(params.id);
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
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t('detail.back')}
        </Button>
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle aria-hidden="true" />
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

            {/*
              D1+D2 sidebar layout — 2-column grid with a sticky 280px sidebar
              showing the student's photo, admission number, current placement,
              and quick stats. Implements rule [LEYPF] and the spec sidebar
              requirement. The sidebar is `print:hidden` so printed pages get
              the full-width content area.
            */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              <aside className="lg:sticky lg:top-6 self-start space-y-4 print:hidden">
                <StudentSidebar student={student} />
              </aside>

              <div className="space-y-4 print:max-w-none">
                <Tabs defaultValue="profile" className="space-y-4">
                  <TabsList className="print:hidden">
                    <TabsTrigger value="profile">
                      <UserRound aria-hidden="true" className="size-4" />
                      {t('detail.tabs.profile')}
                    </TabsTrigger>
                    <TabsTrigger value="academics">
                      <GraduationCap aria-hidden="true" className="size-4" />
                      {t('detail.tabs.academics')}
                    </TabsTrigger>
                    <TabsTrigger value="guardians">
                      <Users aria-hidden="true" className="size-4" />
                      {t('detail.tabs.guardians')}
                    </TabsTrigger>
                    <TabsTrigger value="documents">
                      <FileText aria-hidden="true" className="size-4" />
                      {t('detail.tabs.documents')}
                    </TabsTrigger>
                    <TabsTrigger value="tc">
                      <ClipboardList aria-hidden="true" className="size-4" />
                      {t('detail.tabs.tc')}
                    </TabsTrigger>
                    <TabsTrigger value="audit">
                      <History aria-hidden="true" className="size-4" />
                      {t('detail.tabs.audit')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="profile">
                    <ErrorBoundary FallbackComponent={TabErrorFallback}>
                      <ProfileTab student={student} refetch={() => void refetch()} />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="academics">
                    <ErrorBoundary FallbackComponent={TabErrorFallback}>
                      <AcademicsTab studentProfileId={student.id} />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="guardians">
                    <ErrorBoundary FallbackComponent={TabErrorFallback}>
                      <GuardiansTab studentProfileId={student.id} />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="documents">
                    <ErrorBoundary FallbackComponent={TabErrorFallback}>
                      <DocumentsTab studentProfileId={student.id} />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="tc">
                    <ErrorBoundary FallbackComponent={TabErrorFallback}>
                      <TCHistoryTab studentProfileId={student.id} />
                    </ErrorBoundary>
                  </TabsContent>
                  <TabsContent value="audit">
                    <ErrorBoundary FallbackComponent={TabErrorFallback}>
                      <AuditTab studentId={student.id} />
                    </ErrorBoundary>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
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

// ─── Sidebar (D1+D2 from frontend-ux audit) ───────────────────────────────

/**
 * Left sidebar shown alongside the student detail tabs. Displays the
 * student's photo, admission number, current placement, status badge, and
 * a small set of quick stats. Implements rule [LEYPF] / [LODGO] from
 * frontend-ux. Hidden in print views via `print:hidden` on the wrapping
 * `<aside>` so the printable layout doesn't carry the sidebar gutter.
 */
function StudentSidebar({ student }: { student: StudentDetailNode }) {
  const t = useTranslations('students');
  const { format } = useFormatDate();
  const resolveI18n = useI18nField();
  const firstName = resolveI18n(student.firstName);
  const lastName = resolveI18n(student.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  // Initials for the avatar fallback — first letters of first + last name in
  // the resolved locale. Capped at 2 chars to keep the avatar legible.
  const initials =
    [firstName, lastName]
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || '?';

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col items-center text-center space-y-3">
          <Avatar className="size-24">
            {student.profileImageUrl ? (
              <AvatarImage src={student.profileImageUrl} alt={fullName} />
            ) : null}
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-semibold leading-tight">{fullName}</p>
            <p className="text-xs font-mono text-muted-foreground">{student.admissionNumber}</p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {t(`academicStatuses.${student.academicStatus}`, {
              default: student.academicStatus,
            })}
          </Badge>
          <Can I="update" a="Student">
            <StatusTransitionControl student={student} />
          </Can>
        </div>

        <Separator />

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('detail.sidebar.currentPlacement')}
            </p>
            <p className="font-medium">
              {student.currentStandardId ?? '—'}
              {student.currentSectionId ? ` · ${student.currentSectionId}` : ''}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('detail.sidebar.admittedOn')}
            </p>
            <p className="font-medium">{format(new Date(student.admissionDate), 'dd/MM/yyyy')}</p>
          </div>

          {student.dateOfBirth && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('detail.sidebar.dateOfBirth')}
              </p>
              <p className="font-medium">{format(new Date(student.dateOfBirth), 'dd/MM/yyyy')}</p>
            </div>
          )}

          {student.gender && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('detail.sidebar.gender')}
              </p>
              <p className="font-medium">
                {t(`genders.${student.gender}`, { default: student.gender })}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Status transition control — shown in the sidebar under the status badge.
 * Renders a Select with only the valid next states for the student's current
 * academic status (per `STUDENT_STATUS_TRANSITIONS`). Destructive transitions
 * (withdraw, expel, drop out, transfer out) open a confirmation Dialog that
 * captures a reason (min 10 chars, validated via Zod). Non-destructive
 * transitions fire the mutation immediately.
 *
 * The mutation is scoped via `@InstituteScope` on the backend; authorisation
 * is enforced both server-side (CASL) and client-side via the `<Can>` wrapper
 * in the parent.
 */
const transitionReasonSchema = z.object({
  reason: z.string().min(10),
});
type TransitionReasonValues = z.infer<typeof transitionReasonSchema>;

function StatusTransitionControl({ student }: { student: StudentDetailNode }) {
  const t = useTranslations('students');
  const [transitionStatus, { loading }] = useTransitionStudentStatus();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const reasonForm = useForm<TransitionReasonValues>({
    resolver: zodResolver(transitionReasonSchema),
    defaultValues: { reason: '' },
  });

  const validTransitions = STUDENT_STATUS_TRANSITIONS[student.academicStatus] ?? [];

  const runTransition = async (newStatus: string, reason?: string) => {
    try {
      await transitionStatus({
        variables: { id: student.id, newStatus, reason },
      });
      toast.success(t('detail.status.updated'));
      setPendingStatus(null);
      reasonForm.reset({ reason: '' });
    } catch (err) {
      toast.error((err as Error).message || t('detail.status.updateFailed'));
    }
  };

  const handleSelect = (newStatus: string) => {
    if (DESTRUCTIVE_TRANSITIONS.has(newStatus)) {
      setPendingStatus(newStatus);
      return;
    }
    void runTransition(newStatus);
  };

  const onConfirm = reasonForm.handleSubmit(async (values) => {
    if (!pendingStatus) return;
    await runTransition(pendingStatus, values.reason);
  });

  if (validTransitions.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <Select value="" onValueChange={handleSelect} disabled={loading}>
        <SelectTrigger className="w-full" aria-label={t('detail.status.changeLabel')}>
          <SelectValue
            placeholder={loading ? t('detail.status.updating') : t('detail.status.changeLabel')}
          />
        </SelectTrigger>
        <SelectContent>
          {validTransitions.map((status) => (
            <SelectItem key={status} value={status}>
              {t(`academicStatuses.${status}`, { default: status })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog
        open={pendingStatus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingStatus(null);
            reasonForm.reset({ reason: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('detail.status.confirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('detail.status.confirmDescription', {
                status: pendingStatus
                  ? t(`academicStatuses.${pendingStatus}`, { default: pendingStatus })
                  : '',
              })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onConfirm} className="space-y-4">
            <Field data-invalid={reasonForm.formState.errors.reason ? true : undefined}>
              <FieldLabel htmlFor="transition-reason">{t('detail.status.reason')}</FieldLabel>
              <Textarea
                id="transition-reason"
                rows={4}
                placeholder={t('detail.status.reasonPlaceholder')}
                {...reasonForm.register('reason')}
              />
              {reasonForm.formState.errors.reason && (
                <FieldError>{t('detail.status.reasonTooShort')}</FieldError>
              )}
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPendingStatus(null);
                  reasonForm.reset({ reason: '' });
                }}
                disabled={loading}
              >
                {t('detail.status.cancel')}
              </Button>
              <Button type="submit" variant="destructive" disabled={loading}>
                {loading ? t('detail.status.updating') : t('detail.status.confirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
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
      <Button variant="ghost" size="sm" onClick={onBack} className="print:hidden">
        <ArrowLeft aria-hidden="true" className="size-4" />
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
                <ShieldCheck aria-hidden="true" className="size-3" />
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
  isRteAdmitted: z.boolean(),
  isCwsn: z.boolean(),
  cwsnType: z.string().optional(),
  isMinority: z.boolean(),
  minorityType: z.string().optional(),
  isBpl: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileTab({ student, refetch }: { student: StudentDetailNode; refetch: () => void }) {
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
      isRteAdmitted: student.isRteAdmitted ?? false,
      isCwsn: student.isCwsn ?? false,
      cwsnType: student.cwsnType ?? '',
      isMinority: student.isMinority ?? false,
      minorityType: student.minorityType ?? '',
      isBpl: student.isBpl ?? false,
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
            isRteAdmitted: values.isRteAdmitted,
            isCwsn: values.isCwsn,
            cwsnType: values.isCwsn ? values.cwsnType || undefined : undefined,
            isMinority: values.isMinority,
            minorityType: values.isMinority ? values.minorityType || undefined : undefined,
            isBpl: values.isBpl,
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
        toast.error(t('detail.profile.concurrencyError'), {
          action: {
            label: t('detail.profile.refresh'),
            onClick: () => refetch(),
          },
        });
      } else {
        toast.error(message);
      }
    }
  });

  const isDirty = form.formState.isDirty;

  return (
    <Card className="print:break-inside-avoid">
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
            <FieldSet className="print:break-inside-avoid">
              <FieldLegend>{t('detail.profile.sections.personal')}</FieldLegend>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <I18nInput<ProfileFormValues>
                  name="firstName"
                  label={t('detail.profile.firstName')}
                />
                <I18nInput<ProfileFormValues>
                  name="lastName"
                  label={t('detail.profile.lastName')}
                />
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
                  <FieldLabel htmlFor="bloodGroup">{t('detail.profile.bloodGroup')}</FieldLabel>
                  <Input id="bloodGroup" {...form.register('bloodGroup')} />
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSet className="print:break-inside-avoid">
              <FieldLegend>{t('detail.profile.sections.identity')}</FieldLegend>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="religion">{t('detail.profile.religion')}</FieldLabel>
                  <Input id="religion" {...form.register('religion')} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="caste">
                    {t('detail.profile.caste')}
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Info
                          className="ms-2 size-3.5 text-muted-foreground cursor-help"
                          aria-hidden="true"
                        />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 text-sm">
                        {t('detail.profile.casteHelp')}
                      </HoverCardContent>
                    </HoverCard>
                  </FieldLabel>
                  <Input id="caste" {...form.register('caste')} />
                  <FieldDescription>{t('detail.profile.casteDescription')}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="motherTongue">
                    {t('detail.profile.motherTongue')}
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Info
                          className="ms-2 size-3.5 text-muted-foreground cursor-help"
                          aria-hidden="true"
                        />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 text-sm">
                        {t('detail.profile.motherTongueHelp')}
                      </HoverCardContent>
                    </HoverCard>
                  </FieldLabel>
                  <Input id="motherTongue" {...form.register('motherTongue')} />
                  <FieldDescription>{t('detail.profile.motherTongueDescription')}</FieldDescription>
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSet className="print:break-inside-avoid">
              <FieldLegend>{t('detail.profile.sections.regulatory')}</FieldLegend>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="socialCategory">
                    {t('detail.profile.category')}
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Info
                          className="ms-2 size-3.5 text-muted-foreground cursor-help"
                          aria-hidden="true"
                        />
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 text-sm">
                        {t('detail.profile.socialCategoryHelp')}
                      </HoverCardContent>
                    </HoverCard>
                  </FieldLabel>
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
                  <FieldDescription>
                    {t('detail.profile.socialCategoryDescription')}
                  </FieldDescription>
                </Field>
                <Field className="flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <FieldLabel htmlFor="isRteAdmitted" className="mb-0">
                      {t('detail.profile.rteAdmitted')}
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <Info
                            className="ms-2 size-3.5 text-muted-foreground cursor-help"
                            aria-hidden="true"
                          />
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 text-sm">
                          {t('detail.profile.rteAdmittedHelp')}
                        </HoverCardContent>
                      </HoverCard>
                    </FieldLabel>
                    <FieldDescription>
                      {t('detail.profile.rteAdmittedDescription')}
                    </FieldDescription>
                  </div>
                  <Switch
                    id="isRteAdmitted"
                    checked={form.watch('isRteAdmitted')}
                    onCheckedChange={(v) =>
                      form.setValue('isRteAdmitted', v, { shouldDirty: true })
                    }
                  />
                </Field>
                <Field className="flex-row items-center justify-between gap-3">
                  <FieldLabel htmlFor="isCwsn" className="mb-0">
                    {t('detail.profile.cwsn')}
                  </FieldLabel>
                  <Switch
                    id="isCwsn"
                    checked={form.watch('isCwsn')}
                    onCheckedChange={(v) => form.setValue('isCwsn', v, { shouldDirty: true })}
                  />
                </Field>
                {form.watch('isCwsn') && (
                  <Field>
                    <FieldLabel htmlFor="cwsnType">{t('detail.profile.cwsnTypeLabel')}</FieldLabel>
                    <Input id="cwsnType" {...form.register('cwsnType')} />
                  </Field>
                )}
                <Field className="flex-row items-center justify-between gap-3">
                  <FieldLabel htmlFor="isMinority" className="mb-0">
                    {t('detail.profile.minority')}
                  </FieldLabel>
                  <Switch
                    id="isMinority"
                    checked={form.watch('isMinority')}
                    onCheckedChange={(v) => form.setValue('isMinority', v, { shouldDirty: true })}
                  />
                </Field>
                {form.watch('isMinority') && (
                  <Field>
                    <FieldLabel htmlFor="minorityType">
                      {t('detail.profile.minorityTypeLabel')}
                    </FieldLabel>
                    <Input id="minorityType" {...form.register('minorityType')} />
                  </Field>
                )}
                <Field className="flex-row items-center justify-between gap-3">
                  <FieldLabel htmlFor="isBpl" className="mb-0">
                    {t('detail.profile.bpl')}
                  </FieldLabel>
                  <Switch
                    id="isBpl"
                    checked={form.watch('isBpl')}
                    onCheckedChange={(v) => form.setValue('isBpl', v, { shouldDirty: true })}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSet className="print:break-inside-avoid">
              <FieldLegend>{t('detail.profile.admissionInfo')}</FieldLegend>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>{t('detail.profile.admissionNumber')}</FieldLabel>
                  <p className="text-sm font-mono">{student.admissionNumber}</p>
                </Field>
                <Field>
                  <FieldLabel>{t('detail.profile.admittedOn')}</FieldLabel>
                  <p className="text-sm">{format(new Date(student.admissionDate), 'dd/MM/yyyy')}</p>
                </Field>
                {student.admissionClass && (
                  <Field>
                    <FieldLabel>{t('detail.profile.admissionClass')}</FieldLabel>
                    <p className="text-sm">{student.admissionClass}</p>
                  </Field>
                )}
                <Field>
                  <FieldLabel>{t('detail.profile.admissionType')}</FieldLabel>
                  <p className="text-sm">{student.admissionType}</p>
                </Field>
              </FieldGroup>
            </FieldSet>

            <FieldSet className="print:break-inside-avoid">
              <FieldLegend>{t('detail.profile.medicalInfo')}</FieldLegend>
              {student.medicalInfo && Object.keys(student.medicalInfo).length > 0 ? (
                <FieldGroup className="grid gap-4 sm:grid-cols-2">
                  {Object.entries(student.medicalInfo).map(([key, value]) => (
                    <Field key={key}>
                      <FieldLabel className="capitalize">{key.replace(/_/g, ' ')}</FieldLabel>
                      <p className="text-sm">{String(value ?? '—')}</p>
                    </Field>
                  ))}
                </FieldGroup>
              ) : (
                <p className="text-sm text-muted-foreground">{t('detail.profile.medicalEmpty')}</p>
              )}
            </FieldSet>

            <Separator />

            <div className="text-xs text-muted-foreground">
              {t('detail.profile.version')}: <span className="font-mono">v{student.version}</span>
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
            <ClipboardList aria-hidden="true" />
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
                  {format(new Date(tc.createdAt), 'dd/MM/yyyy')}
                </p>
              </div>
              {tc.pdfUrl && (
                <Button variant="outline" size="sm" asChild className="print:hidden">
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
  return <EntityTimeline entityType="Student" entityId={studentId} />;
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
            <GraduationCap aria-hidden="true" />
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
                    <CheckCircle2 aria-hidden="true" className="size-3" />
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
              {format(new Date(row.updatedAt), 'dd/MM/yyyy')}
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
            <Users aria-hidden="true" />
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
                        <Star aria-hidden="true" className="size-3" />
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
                        <CheckCircle2 aria-hidden="true" className="size-3 text-emerald-600" />
                        {t('detail.guardians.canPickup')}
                      </span>
                    )}
                    {g.livesWith && (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 aria-hidden="true" className="size-3 text-emerald-600" />
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

function UploadDocumentDialog({
  studentProfileId,
  open,
  onOpenChange,
}: {
  studentProfileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('students');
  const [uploadDocument, { loading }] = useUploadStudentDocument();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UploadDocumentForm>({
    resolver: zodResolver(uploadDocumentSchema),
    defaultValues: {
      type: 'birth_certificate',
      description: '',
      fileUrlsRaw: '',
      referenceNumber: '',
    },
  });

  React.useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const typeValue = watch('type');

  const onSubmit = async (values: UploadDocumentForm) => {
    const fileUrls = values.fileUrlsRaw
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
    if (fileUrls.length === 0) {
      toast.error(t('detail.documents.upload.error'));
      return;
    }
    try {
      await uploadDocument({
        variables: {
          input: {
            studentProfileId,
            type: values.type,
            description: values.description || undefined,
            fileUrls,
            referenceNumber: values.referenceNumber || undefined,
          },
        },
      });
      toast.success(t('detail.documents.upload.success'));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('detail.documents.upload.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('detail.documents.upload.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('detail.documents.upload.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="upload-doc-type">
                {t('detail.documents.upload.typeLabel')}
              </FieldLabel>
              <Select
                value={typeValue}
                onValueChange={(v) =>
                  setValue('type', v as (typeof DOCUMENT_TYPES)[number], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="upload-doc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {t(`detail.documents.types.${dt}`, { default: dt })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <FieldError>{errors.type.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="upload-doc-description">
                {t('detail.documents.upload.descriptionLabel')}
              </FieldLabel>
              <Textarea
                id="upload-doc-description"
                rows={2}
                {...register('description')}
                placeholder={t('detail.documents.upload.descriptionPlaceholder')}
              />
              {errors.description && <FieldError>{errors.description.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="upload-doc-urls">
                {t('detail.documents.upload.fileUrlsLabel')}
              </FieldLabel>
              <Textarea
                id="upload-doc-urls"
                rows={3}
                {...register('fileUrlsRaw')}
                placeholder={t('detail.documents.upload.fileUrlsPlaceholder')}
              />
              <FieldDescription>{t('detail.documents.upload.fileUrlsHelp')}</FieldDescription>
              {errors.fileUrlsRaw && <FieldError>{errors.fileUrlsRaw.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="upload-doc-ref">
                {t('detail.documents.upload.referenceNumberLabel')}
              </FieldLabel>
              <Input
                id="upload-doc-ref"
                {...register('referenceNumber')}
                placeholder={t('detail.documents.upload.referenceNumberPlaceholder')}
              />
              {errors.referenceNumber && <FieldError>{errors.referenceNumber.message}</FieldError>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('detail.documents.upload.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? t('detail.documents.upload.submitting')
                : t('detail.documents.upload.submitLabel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocumentsTab({ studentProfileId }: { studentProfileId: string }) {
  const t = useTranslations('students');
  const { format } = useFormatDate();
  const { data, loading } = useStudentDocuments(studentProfileId);
  const [uploadOpen, setUploadOpen] = useState(false);

  if (loading && !data) {
    return <TabSkeleton />;
  }

  const docs = data?.listStudentDocuments ?? [];

  const header = (
    <Can I="update" a="Student">
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
          <FileText aria-hidden="true" className="size-4" />
          {t('detail.documents.upload.uploadButton')}
        </Button>
      </div>
    </Can>
  );

  if (docs.length === 0) {
    return (
      <div className="space-y-3">
        {header}
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>{t('detail.documents.empty')}</EmptyTitle>
            <EmptyDescription>{t('detail.documents.emptyDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        <UploadDocumentDialog
          studentProfileId={studentProfileId}
          open={uploadOpen}
          onOpenChange={setUploadOpen}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {header}
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
                      <CheckCircle2 aria-hidden="true" className="size-3" />
                      {t('detail.documents.verified')}
                    </Badge>
                  ) : doc.rejectionReason ? (
                    <Badge variant="outline" className="border-rose-300 text-rose-700">
                      <XCircle aria-hidden="true" className="size-3" />
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
                  {format(new Date(doc.createdAt), 'dd/MM/yyyy')}
                  {doc.expiryDate
                    ? ` · ${t('detail.documents.expires')} ${format(new Date(doc.expiryDate), 'dd/MM/yyyy')}`
                    : ''}
                </p>
              </div>
              {doc.fileUrls.length > 0 && (
                <div className="flex flex-col gap-1 print:hidden">
                  {doc.fileUrls.map((url, idx) => (
                    <Button key={url} variant="outline" size="sm" asChild>
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <FileDown aria-hidden="true" className="size-3" />
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
      <UploadDocumentDialog
        studentProfileId={studentProfileId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
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
