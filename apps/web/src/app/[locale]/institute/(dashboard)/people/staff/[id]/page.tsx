'use client';

import type { EmploymentType, SocialCategory as GqlSocialCategory } from '@roviq/graphql/generated';
import { i18nTextOptionalSchema, i18nTextSchema, useFormatDate, useI18nField } from '@roviq/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  I18nField,
  Input,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useAppForm,
  useBreadcrumbOverride,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { parseISO } from 'date-fns';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  GraduationCap,
  History,
  LayersIcon,
  Pencil,
  Plus,
  Star,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../../hooks/use-form-draft';
import {
  type StaffDetailNode,
  type StaffQualificationNode,
  useCreateStaffQualification,
  useDeleteStaffQualification,
  useStaffMember,
  useStaffQualifications,
  useUpdateStaffMember,
  useUpdateStaffQualification,
} from '../use-staff';

/**
 * Employment types — mirrors the server's `staff_profiles.employment_type`
 * enum. Centralised here so the profile form dropdown, the sidebar
 * formatter, and the list page all pick from the same canonical list.
 */
const EMPLOYMENT_TYPES = ['REGULAR', 'CONTRACTUAL', 'PART_TIME', 'GUEST', 'VOLUNTEER'] as const;
const SOCIAL_CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as const;
const QUALIFICATION_TYPES = ['ACADEMIC', 'PROFESSIONAL'] as const;

export default function StaffDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('staff');
  const { data, loading, error } = useStaffMember(params.id);
  const resolveI18nName = useI18nField();
  const staff = data?.getStaffMember;

  useBreadcrumbOverride(
    staff
      ? {
          [params.id]: [
            resolveI18nName(staff.firstName),
            staff.lastName ? resolveI18nName(staff.lastName) : '',
          ]
            .filter(Boolean)
            .join(' '),
        }
      : {},
  );

  if (loading && !data) {
    return <StaffDetailSkeleton />;
  }

  if (error || !staff) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/institute/people/staff')}
          className="min-h-11"
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

  return (
    <Can I="read" a="Staff" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <StaffHeader staff={staff} onBack={() => router.push('/institute/people/staff')} />

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              <aside className="lg:sticky lg:top-6 self-start space-y-4 print:hidden">
                <StaffSidebar staff={staff} />
              </aside>

              <div className="space-y-4 print:max-w-none">
                <Tabs defaultValue="profile" className="space-y-4">
                  <TabsList>
                    <TabsTrigger
                      value="profile"
                      className="min-h-11"
                      data-testid="staff-detail-tab-profile"
                    >
                      <UserRound className="size-4" />
                      {t('tabs.profile')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="qualifications"
                      className="min-h-11"
                      data-testid="staff-detail-tab-qualifications"
                    >
                      <GraduationCap className="size-4" />
                      {t('tabs.qualifications')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="sections"
                      className="min-h-11"
                      data-testid="staff-detail-tab-sections"
                    >
                      <LayersIcon className="size-4" />
                      {t('tabs.assignedSections')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="audit"
                      className="min-h-11"
                      data-testid="staff-detail-tab-audit"
                    >
                      <History className="size-4" />
                      {t('tabs.audit')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="profile">
                    <ProfileTab staff={staff} loading={loading} />
                  </TabsContent>
                  <TabsContent value="qualifications">
                    <QualificationsTab staffProfileId={staff.id} />
                  </TabsContent>
                  <TabsContent value="sections">
                    <AssignedSectionsTab />
                  </TabsContent>
                  <TabsContent value="audit">
                    <AuditTab staffId={staff.id} />
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

// ─── Sidebar ─────────────────────────────────────────────────────────────

/**
 * Left sidebar for the staff detail page. Mirrors StudentSidebar: avatar,
 * name, employee ID, status badge, and a key-value strip of quick facts.
 * `print:hidden` on the wrapping aside keeps the printable layout clean.
 */
function StaffSidebar({ staff }: { staff: StaffDetailNode }) {
  const t = useTranslations('staff');
  const { format } = useFormatDate();
  const resolveI18n = useI18nField();
  const firstName = resolveI18n(staff.firstName);
  const lastName = staff.lastName ? resolveI18n(staff.lastName) : '';
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
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
            {staff.profileImageUrl ? (
              <AvatarImage src={staff.profileImageUrl} alt={fullName} />
            ) : null}
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-semibold leading-tight">{fullName}</p>
            {staff.employeeId ? (
              <p className="text-xs font-mono text-muted-foreground">{staff.employeeId}</p>
            ) : null}
          </div>
          {staff.employmentType ? (
            <Badge variant="secondary" className="text-xs">
              {t(`employmentTypes.${staff.employmentType}`, {
                default: staff.employmentType,
              })}
            </Badge>
          ) : null}
          {staff.isClassTeacher ? (
            <Badge
              variant="outline"
              className="text-xs inline-flex items-center gap-1 border-amber-300 text-amber-700"
            >
              <Star className="size-3" />
              {t('detail.sidebar.classTeacher')}
            </Badge>
          ) : null}
        </div>

        <Separator />

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('detail.sidebar.designation')}
            </p>
            <p className="font-medium">{staff.designation ?? t('detail.sidebar.notSet')}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('detail.sidebar.department')}
            </p>
            <p className="font-medium">{staff.department ?? t('detail.sidebar.notSet')}</p>
          </div>
          {staff.dateOfJoining ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('detail.sidebar.joined')}
              </p>
              <p className="font-medium">{format(parseISO(staff.dateOfJoining), 'dd/MM/yyyy')}</p>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────

function StaffHeader({ staff, onBack }: { staff: StaffDetailNode; onBack: () => void }) {
  const t = useTranslations('staff');
  const resolveI18n = useI18nField();
  const fullName = [resolveI18n(staff.firstName), staff.lastName ? resolveI18n(staff.lastName) : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="min-h-11">
        <ArrowLeft className="size-4" />
        {t('detail.back')}
      </Button>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 data-testid="staff-detail-title" className="text-2xl font-bold tracking-tight">
            {fullName}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {staff.employeeId ? <span className="font-mono">{staff.employeeId}</span> : null}
            {staff.designation ? (
              <>
                <span>·</span>
                <span>{staff.designation}</span>
              </>
            ) : null}
            {staff.isClassTeacher ? (
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-700 inline-flex items-center gap-1"
              >
                <Star className="size-3" />
                {t('detail.sidebar.classTeacher')}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Profile tab (editable) ──────────────────────────────────────────────

/**
 * Zod schema for the editable subset of staff profile fields. We only edit
 * fields that are semantically safe to change post-onboarding. Dates of
 * birth and joining are read-only in this form; the employee ID is
 * assigned at creation and not editable here. Status transitions (activate
 * / deactivate) must go through named domain mutations — not implemented on
 * this tab by design (see `.claude/rules/entity-lifecycle.md`).
 */
const profileSchema = z.object({
  firstName: i18nTextSchema,
  // Optional schema accepts an all-empty `{ en: '', hi: '' }` object — required
  // because the I18nField always renders both locale rows and would emit
  // empty strings rather than `undefined` when the user clears them.
  lastName: i18nTextOptionalSchema,
  designation: z.string().optional(),
  department: z.string().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  isClassTeacher: z.boolean(),
  socialCategory: z.enum(SOCIAL_CATEGORIES).optional(),
  specialization: z.string().optional(),
});

type ProfileFormSchema = typeof profileSchema;
type ProfileFormValues = z.input<ProfileFormSchema>;

function ProfileTab({ staff, loading: pageLoading }: { staff: StaffDetailNode; loading: boolean }) {
  const t = useTranslations('staff');
  const { format } = useFormatDate();
  const [updateStaffMember, { loading }] = useUpdateStaffMember();

  // Backfill `hi: ''` on i18n columns the server omits so every locale row
  // the I18nField renders is bound to a defined string. Without this the
  // first keystroke in `hi` would dirty an undefined → string transition
  // and invalidate equality-based dirty checks.
  const defaultValues: ProfileFormValues = React.useMemo(
    () => ({
      firstName: { en: staff.firstName.en ?? '', hi: staff.firstName.hi ?? '' },
      lastName: staff.lastName
        ? { en: staff.lastName.en ?? '', hi: staff.lastName.hi ?? '' }
        : { en: '', hi: '' },
      designation: staff.designation ?? '',
      department: staff.department ?? '',
      employmentType: (staff.employmentType as ProfileFormValues['employmentType']) ?? undefined,
      isClassTeacher: staff.isClassTeacher,
      socialCategory: (staff.socialCategory as ProfileFormValues['socialCategory']) ?? undefined,
      specialization: staff.specialization ?? '',
    }),
    [staff],
  );

  const form = useAppForm({
    defaultValues,
    validators: { onChange: profileSchema, onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      const parsed = profileSchema.parse(value);
      try {
        await updateStaffMember({
          variables: {
            id: staff.id,
            input: {
              designation: parsed.designation || undefined,
              department: parsed.department || undefined,
              employmentType: parsed.employmentType as EmploymentType | undefined,
              isClassTeacher: parsed.isClassTeacher,
              specialization: parsed.specialization || undefined,
              socialCategory: parsed.socialCategory as GqlSocialCategory | undefined,
              // Optimistic-concurrency metadata — read from the freshest
              // Apollo-cached record so each submit races cleanly against
              // whatever version the server just returned.
              version: staff.version,
            },
          },
        });
        toast.success(t('detail.profile.saved'));
        // Reset dirty flag using the just-submitted values so the Save button
        // re-disables until the user edits again.
        form.reset(value);
        clearDraft();
      } catch (err) {
        const message = (err as Error).message;
        if (message.toLowerCase().includes('version') || message.includes('CONCURRENT')) {
          toast.error(t('detail.profile.concurrencyError'));
        } else {
          toast.error(message);
        }
      }
    },
  });

  const { hasDraft, restoreDraft, discardDraft, clearDraft } = useFormDraft<ProfileFormValues>({
    key: `staff-profile:${staff.id}`,
    form,
    enabled: !pageLoading && !loading,
  });

  // Drive the submit-button disabled state without re-rendering the whole
  // tab on every keystroke.
  const isDirty = useStore(form.store, (state) => state.isDirty);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.profile.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {hasDraft && (
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
              <Button
                variant="outline"
                size="sm"
                onClick={discardDraft}
                className="min-h-11"
                data-testid="staff-detail-draft-discard-btn"
              >
                {t('detail.profile.draftDiscard')}
              </Button>
              <Button
                size="sm"
                onClick={restoreDraft}
                className="min-h-11"
                data-testid="staff-detail-draft-restore-btn"
              >
                {t('detail.profile.draftRestore')}
              </Button>
            </div>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-6"
        >
          <FieldSet>
            <FieldLegend>{t('detail.profile.personal')}</FieldLegend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <I18nField
                form={form}
                name="firstName"
                label={t('detail.profile.firstName')}
                testId="staff-detail-firstname-input"
              />
              <I18nField
                form={form}
                name="lastName"
                label={t('detail.profile.lastName')}
                testId="staff-detail-lastname-input"
              />
              <Field>
                <FieldLabel htmlFor="staff-dob">{t('detail.profile.dateOfBirth')}</FieldLabel>
                <Input
                  id="staff-dob"
                  value={
                    staff.dateOfBirth
                      ? format(parseISO(staff.dateOfBirth), 'dd/MM/yyyy')
                      : t('detail.sidebar.notSet')
                  }
                  readOnly
                  disabled
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>{t('detail.profile.employment')}</FieldLegend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="staff-emp-id">{t('detail.profile.employeeId')}</FieldLabel>
                <Input
                  id="staff-emp-id"
                  value={staff.employeeId ?? t('detail.sidebar.notSet')}
                  readOnly
                  disabled
                  className="font-mono"
                />
              </Field>
              <form.AppField name="designation">
                {(field) => (
                  <field.TextField
                    label={t('detail.profile.designation')}
                    description={t('fieldDescriptions.designation')}
                    placeholder={t('detail.profile.designationPlaceholder')}
                    testId="staff-detail-designation-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="department">
                {(field) => (
                  <field.TextField
                    label={t('detail.profile.department')}
                    description={t('fieldDescriptions.department')}
                    placeholder={t('detail.profile.departmentPlaceholder')}
                    testId="staff-detail-department-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="employmentType">
                {(field) => (
                  <field.SelectField
                    label={t('detail.profile.employmentType')}
                    placeholder={t('detail.profile.employmentTypePlaceholder')}
                    options={EMPLOYMENT_TYPES.map((et) => ({
                      value: et,
                      label: t(`employmentTypes.${et}`),
                    }))}
                    testId="staff-detail-employment-type-select"
                  />
                )}
              </form.AppField>
              <Field>
                <FieldLabel htmlFor="staff-joining">{t('detail.profile.dateOfJoining')}</FieldLabel>
                <Input
                  id="staff-joining"
                  value={
                    staff.dateOfJoining
                      ? format(parseISO(staff.dateOfJoining), 'dd/MM/yyyy')
                      : t('detail.sidebar.notSet')
                  }
                  readOnly
                  disabled
                />
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>{t('detail.profile.other')}</FieldLegend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <form.AppField name="isClassTeacher">
                {(field) => (
                  <field.SwitchField
                    label={t('detail.profile.isClassTeacher')}
                    description={t('detail.profile.isClassTeacherDescription')}
                    testId="staff-detail-class-teacher-switch"
                  />
                )}
              </form.AppField>
              <form.AppField name="socialCategory">
                {(field) => (
                  <field.SelectField
                    label={t('detail.profile.socialCategory')}
                    placeholder={t('detail.profile.socialCategoryPlaceholder')}
                    options={SOCIAL_CATEGORIES.map((c) => ({ value: c, label: c }))}
                    testId="staff-detail-social-category-select"
                  />
                )}
              </form.AppField>
              <form.AppField name="specialization">
                {(field) => (
                  <field.TextField
                    label={t('detail.profile.specialization')}
                    description={t('fieldDescriptions.specialization')}
                    placeholder={t('detail.profile.specializationPlaceholder')}
                    testId="staff-detail-specialization-input"
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </FieldSet>

          <div className="flex justify-end gap-2">
            <Can I="update" a="Staff">
              <form.AppForm>
                <form.SubmitButton
                  testId="staff-detail-save-btn"
                  disabled={!isDirty || loading}
                  submittingLabel={t('detail.profile.saving')}
                  className="min-h-11"
                >
                  {t('detail.profile.save')}
                </form.SubmitButton>
              </form.AppForm>
            </Can>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Qualifications tab ─────────────────────────────────────────────────

const qualificationSchema = z.object({
  type: z.enum(QUALIFICATION_TYPES),
  degreeName: z.string().min(1),
  institution: z.string().optional(),
  boardUniversity: z.string().optional(),
  // Allow empty string from a never-touched numeric input. The transform
  // collapses both empty string and undefined to `undefined` before the
  // mutation runs, matching the GraphQL `Int` optional contract.
  yearOfPassing: z
    .union([z.coerce.number().int().min(1900).max(2100), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : (v as number))),
  gradePercentage: z.string().optional(),
});

type QualificationFormValues = z.input<typeof qualificationSchema>;

function QualificationsTab({ staffProfileId }: { staffProfileId: string }) {
  const t = useTranslations('staff');
  const { data, loading } = useStaffQualifications(staffProfileId);
  const qualifications = data?.listStaffQualifications ?? [];

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffQualificationNode | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<StaffQualificationNode | null>(null);

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);
  const openEdit = React.useCallback((q: StaffQualificationNode) => {
    setEditing(q);
    setDialogOpen(true);
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{t('detail.qualifications.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('detail.qualifications.description')}</p>
        </div>
        <Can I="update" a="Staff">
          <Button
            onClick={openCreate}
            className="min-h-11"
            data-testid="staff-detail-add-qualification-btn"
          >
            <Plus className="size-4" />
            {t('detail.qualifications.add')}
          </Button>
        </Can>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && qualifications.length === 0 ? (
          <Skeleton className="h-24 w-full" />
        ) : qualifications.length === 0 ? (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GraduationCap />
              </EmptyMedia>
              <EmptyTitle>{t('detail.qualifications.empty')}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="space-y-3">
            {qualifications.map((q) => (
              <li
                key={q.id}
                className="rounded-md border p-4 flex items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {t(`detail.qualifications.types.${q.type}`, { default: q.type })}
                    </Badge>
                    <p className="font-semibold">{q.degreeName}</p>
                  </div>
                  {q.institution || q.boardUniversity ? (
                    <p className="text-sm text-muted-foreground">
                      {[q.institution, q.boardUniversity].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {q.yearOfPassing ? (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {q.yearOfPassing}
                      </span>
                    ) : null}
                    {q.gradePercentage ? <span>{q.gradePercentage}</span> : null}
                  </div>
                </div>
                <Can I="update" a="Staff">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(q)}
                      className="min-h-11 min-w-11"
                      title={t('detail.qualifications.edit')}
                      aria-label={t('detail.qualifications.edit')}
                      data-testid={`staff-qualification-edit-btn-${q.id}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(q)}
                      className="min-h-11 min-w-11 text-rose-600 hover:text-rose-700"
                      title={t('detail.qualifications.delete')}
                      aria-label={t('detail.qualifications.delete')}
                      data-testid={`staff-qualification-delete-btn-${q.id}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </Can>
              </li>
            ))}
          </ul>
        )}

        <QualificationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          staffProfileId={staffProfileId}
          editing={editing}
        />

        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <DeleteConfirmContent target={deleteTarget} onDone={() => setDeleteTarget(null)} />
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function DeleteConfirmContent({
  target,
  onDone,
}: {
  target: StaffQualificationNode | null;
  onDone: () => void;
}) {
  const t = useTranslations('staff');
  const [deleteQual, { loading }] = useDeleteStaffQualification();

  const handleDelete = async () => {
    if (!target) return;
    try {
      await deleteQual({ variables: { id: target.id } });
      toast.success(t('detail.qualifications.deleteSuccess'));
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t('detail.qualifications.deleteConfirmTitle')}</AlertDialogTitle>
        <AlertDialogDescription>
          {t('detail.qualifications.deleteConfirmDescription')}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={loading} data-testid="staff-qualification-delete-cancel-btn">
          {t('detail.qualifications.cancel')}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={handleDelete}
          disabled={loading}
          className="bg-rose-600 hover:bg-rose-700 text-white"
          data-testid="staff-qualification-delete-confirm-btn"
        >
          {t('detail.qualifications.deleteConfirm')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

const EMPTY_QUALIFICATION_VALUES: QualificationFormValues = {
  type: 'ACADEMIC',
  degreeName: '',
  institution: '',
  boardUniversity: '',
  yearOfPassing: '',
  gradePercentage: '',
};

function QualificationDialog({
  open,
  onOpenChange,
  staffProfileId,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffProfileId: string;
  editing: StaffQualificationNode | null;
}) {
  const t = useTranslations('staff');
  const [createQual, { loading: creating }] = useCreateStaffQualification();
  const [updateQual, { loading: updating }] = useUpdateStaffQualification();
  const loading = creating || updating;

  const buildDefaults = React.useCallback(
    (): QualificationFormValues =>
      editing
        ? {
            type: (editing.type as QualificationFormValues['type']) ?? 'ACADEMIC',
            degreeName: editing.degreeName,
            institution: editing.institution ?? '',
            boardUniversity: editing.boardUniversity ?? '',
            yearOfPassing: editing.yearOfPassing ?? '',
            gradePercentage: editing.gradePercentage ?? '',
          }
        : EMPTY_QUALIFICATION_VALUES,
    [editing],
  );

  const form = useAppForm({
    defaultValues: buildDefaults(),
    validators: { onChange: qualificationSchema, onSubmit: qualificationSchema },
    onSubmit: async ({ value }) => {
      const parsed = qualificationSchema.parse(value);
      try {
        if (editing) {
          await updateQual({
            variables: {
              id: editing.id,
              input: {
                type: parsed.type,
                degreeName: parsed.degreeName,
                institution: parsed.institution || undefined,
                boardUniversity: parsed.boardUniversity || undefined,
                yearOfPassing: parsed.yearOfPassing,
                gradePercentage: parsed.gradePercentage || undefined,
              },
            },
          });
          toast.success(t('detail.qualifications.updateSuccess'));
        } else {
          await createQual({
            variables: {
              input: {
                staffProfileId,
                type: parsed.type,
                degreeName: parsed.degreeName,
                institution: parsed.institution || undefined,
                boardUniversity: parsed.boardUniversity || undefined,
                yearOfPassing: parsed.yearOfPassing,
                gradePercentage: parsed.gradePercentage || undefined,
              },
            },
          });
          toast.success(t('detail.qualifications.createSuccess'));
        }
        onOpenChange(false);
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
  });

  // Reset whenever the dialog opens or the edit target changes — mirrors the
  // original RHF effect. `keepDefaultValues: true` works around
  // tanstack/form#1798 where a follow-up reconcile pass would otherwise
  // revert the reset.
  React.useEffect(() => {
    if (open) {
      form.reset(buildDefaults(), { keepDefaultValues: true });
    }
  }, [open, buildDefaults, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="staff-qualification-dialog">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('detail.qualifications.dialogEditTitle')
              : t('detail.qualifications.dialogCreateTitle')}
          </DialogTitle>
          <DialogDescription>{t('detail.qualifications.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <FieldGroup className="grid gap-4">
            <form.AppField name="type">
              {(field) => (
                <field.SelectField
                  label={t('detail.qualifications.fields.type')}
                  placeholder={t('detail.qualifications.fields.typePlaceholder')}
                  optional={false}
                  options={QUALIFICATION_TYPES.map((qt) => ({
                    value: qt,
                    label: t(`detail.qualifications.types.${qt}`),
                  }))}
                  testId="staff-qualification-type-select"
                />
              )}
            </form.AppField>
            <form.AppField name="degreeName">
              {(field) => (
                <field.TextField
                  label={t('detail.qualifications.fields.degreeName')}
                  placeholder={t('detail.qualifications.fields.degreeNamePlaceholder')}
                  testId="staff-qualification-degree-input"
                />
              )}
            </form.AppField>
            <form.AppField name="institution">
              {(field) => (
                <field.TextField
                  label={t('detail.qualifications.fields.institution')}
                  placeholder={t('detail.qualifications.fields.institutionPlaceholder')}
                  testId="staff-qualification-institution-input"
                />
              )}
            </form.AppField>
            <form.AppField name="boardUniversity">
              {(field) => (
                <field.TextField
                  label={t('detail.qualifications.fields.boardUniversity')}
                  placeholder={t('detail.qualifications.fields.boardUniversityPlaceholder')}
                  testId="staff-qualification-board-input"
                />
              )}
            </form.AppField>
            <div className="grid grid-cols-2 gap-4">
              <form.AppField name="yearOfPassing">
                {(field) => (
                  <field.TextField
                    label={t('detail.qualifications.fields.yearOfPassing')}
                    placeholder={t('detail.qualifications.fields.yearOfPassingPlaceholder')}
                    inputMode="text"
                    testId="staff-qualification-year-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="gradePercentage">
                {(field) => (
                  <field.TextField
                    label={t('detail.qualifications.fields.gradePercentage')}
                    placeholder={t('detail.qualifications.fields.gradePercentagePlaceholder')}
                    testId="staff-qualification-grade-input"
                  />
                )}
              </form.AppField>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="min-h-11"
              data-testid="staff-qualification-cancel-btn"
            >
              {t('detail.qualifications.cancel')}
            </Button>
            <form.AppForm>
              <form.SubmitButton
                disabled={loading}
                submittingLabel={t('detail.qualifications.saving')}
                className="min-h-11"
                testId="staff-qualification-save-btn"
              >
                {t('detail.qualifications.save')}
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assigned sections tab ──────────────────────────────────────────────

/**
 * Placeholder tab showing an empty state until a backend query for "sections
 * where this staff member is class teacher" is added. The section assignment
 * feature is out of scope for rov-169 but the tab is wired so the nav shape
 * is complete and the empty state communicates clearly that nothing is
 * currently assigned.
 */
function AssignedSectionsTab() {
  const t = useTranslations('staff');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.assignedSections.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Empty className="py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Briefcase />
            </EmptyMedia>
            <EmptyTitle>{t('detail.assignedSections.empty')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </CardContent>
    </Card>
  );
}

// ─── Audit tab ──────────────────────────────────────────────────────────

function AuditTab({ staffId }: { staffId: string }) {
  const t = useTranslations('staff');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('detail.audit.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <EntityTimeline entityType="Staff" entityId={staffId} />
      </CardContent>
    </Card>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────

function StaffDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <Skeleton className="h-80 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
