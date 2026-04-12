'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { EmploymentType, SocialCategory as GqlSocialCategory } from '@roviq/graphql/generated';
import { i18nTextSchema, useFormatDate, useI18nField } from '@roviq/i18n';
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
  FieldDescription,
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
  Separator,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useBreadcrumbOverride,
} from '@roviq/ui';
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
import { FormProvider, useForm } from 'react-hook-form';
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
                    <TabsTrigger value="profile" className="min-h-11">
                      <UserRound className="size-4" />
                      {t('tabs.profile')}
                    </TabsTrigger>
                    <TabsTrigger value="qualifications" className="min-h-11">
                      <GraduationCap className="size-4" />
                      {t('tabs.qualifications')}
                    </TabsTrigger>
                    <TabsTrigger value="sections" className="min-h-11">
                      <LayersIcon className="size-4" />
                      {t('tabs.assignedSections')}
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="min-h-11">
                      <History className="size-4" />
                      {t('tabs.audit')}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="profile">
                    <ProfileTab staff={staff} />
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
              <p className="font-medium">{format(new Date(staff.dateOfJoining), 'dd/MM/yyyy')}</p>
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
          <h1 data-test-id="staff-detail-title" className="text-2xl font-bold tracking-tight">
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
  lastName: i18nTextSchema.optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  isClassTeacher: z.boolean(),
  socialCategory: z.enum(SOCIAL_CATEGORIES).optional(),
  specialization: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileTab({ staff }: { staff: StaffDetailNode }) {
  const t = useTranslations('staff');
  const { format } = useFormatDate();
  const [updateStaffMember, { loading }] = useUpdateStaffMember();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: staff.firstName ?? { en: '' },
      lastName: staff.lastName ?? undefined,
      designation: staff.designation ?? '',
      department: staff.department ?? '',
      employmentType: (staff.employmentType as ProfileFormValues['employmentType']) ?? undefined,
      isClassTeacher: staff.isClassTeacher,
      socialCategory: (staff.socialCategory as ProfileFormValues['socialCategory']) ?? undefined,
      specialization: staff.specialization ?? '',
    },
  });

  const draft = useFormDraft({
    key: `staff-profile:${staff.id}`,
    form,
    enabled: !loading,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateStaffMember({
        variables: {
          id: staff.id,
          input: {
            designation: values.designation || undefined,
            department: values.department || undefined,
            employmentType: values.employmentType as EmploymentType | undefined,
            isClassTeacher: values.isClassTeacher,
            specialization: values.specialization || undefined,
            socialCategory: values.socialCategory as GqlSocialCategory | undefined,
            version: staff.version,
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
  const isClassTeacher = form.watch('isClassTeacher');

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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={draft.discardDraft}
                  className="min-h-11"
                >
                  {t('detail.profile.draftDiscard')}
                </Button>
                <Button size="sm" onClick={draft.restoreDraft} className="min-h-11">
                  {t('detail.profile.draftRestore')}
                </Button>
              </div>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-6">
            <FieldSet>
              <FieldLegend>{t('detail.profile.personal')}</FieldLegend>
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
                  <FieldLabel htmlFor="staff-dob">{t('detail.profile.dateOfBirth')}</FieldLabel>
                  <Input
                    id="staff-dob"
                    value={
                      staff.dateOfBirth
                        ? format(new Date(staff.dateOfBirth), 'dd/MM/yyyy')
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
                <Field>
                  <FieldLabel htmlFor="staff-designation">
                    {t('detail.profile.designation')}
                  </FieldLabel>
                  <Input
                    id="staff-designation"
                    {...form.register('designation')}
                    placeholder={t('detail.profile.designationPlaceholder')}
                  />
                  <FieldDescription>{t('fieldDescriptions.designation')}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="staff-department">
                    {t('detail.profile.department')}
                  </FieldLabel>
                  <Input
                    id="staff-department"
                    {...form.register('department')}
                    placeholder={t('detail.profile.departmentPlaceholder')}
                  />
                  <FieldDescription>{t('fieldDescriptions.department')}</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="staff-employmentType">
                    {t('detail.profile.employmentType')}
                  </FieldLabel>
                  <Select
                    value={form.watch('employmentType') ?? ''}
                    onValueChange={(v) =>
                      form.setValue('employmentType', v as ProfileFormValues['employmentType'], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="staff-employmentType">
                      <SelectValue placeholder={t('detail.profile.employmentTypePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPES.map((et) => (
                        <SelectItem key={et} value={et}>
                          {t(`employmentTypes.${et}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="staff-joining">
                    {t('detail.profile.dateOfJoining')}
                  </FieldLabel>
                  <Input
                    id="staff-joining"
                    value={
                      staff.dateOfJoining
                        ? format(new Date(staff.dateOfJoining), 'dd/MM/yyyy')
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
                <Field>
                  <FieldLabel htmlFor="staff-isClassTeacher">
                    {t('detail.profile.isClassTeacher')}
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="staff-isClassTeacher"
                      checked={isClassTeacher}
                      onCheckedChange={(checked) =>
                        form.setValue('isClassTeacher', checked, { shouldDirty: true })
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {isClassTeacher ? t('classTeacher.yes') : t('classTeacher.no')}
                    </span>
                  </div>
                  <FieldDescription>
                    {t('detail.profile.isClassTeacherDescription')}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="staff-socialCategory">
                    {t('detail.profile.socialCategory')}
                  </FieldLabel>
                  <Select
                    value={form.watch('socialCategory') ?? ''}
                    onValueChange={(v) =>
                      form.setValue('socialCategory', v as ProfileFormValues['socialCategory'], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger id="staff-socialCategory">
                      <SelectValue placeholder={t('detail.profile.socialCategoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIAL_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="staff-specialization">
                    {t('detail.profile.specialization')}
                  </FieldLabel>
                  <Input
                    id="staff-specialization"
                    {...form.register('specialization')}
                    placeholder={t('detail.profile.specializationPlaceholder')}
                  />
                  <FieldDescription>{t('fieldDescriptions.specialization')}</FieldDescription>
                </Field>
              </FieldGroup>
            </FieldSet>

            <div className="flex justify-end gap-2">
              <Can I="update" a="Staff">
                <Button type="submit" disabled={!isDirty || loading} className="min-h-11">
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

// ─── Qualifications tab ─────────────────────────────────────────────────

const qualificationSchema = z.object({
  type: z.enum(QUALIFICATION_TYPES),
  degreeName: z.string().min(1),
  institution: z.string().optional(),
  boardUniversity: z.string().optional(),
  yearOfPassing: z
    .union([z.coerce.number().int().min(1900).max(2100), z.literal('')])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : (v as number))),
  gradePercentage: z.string().optional(),
});

type QualificationFormValues = z.input<typeof qualificationSchema>;
type QualificationFormParsed = z.output<typeof qualificationSchema>;

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
          <Button onClick={openCreate} className="min-h-11">
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
        <AlertDialogCancel disabled={loading}>
          {t('detail.qualifications.cancel')}
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={handleDelete}
          disabled={loading}
          className="bg-rose-600 hover:bg-rose-700 text-white"
        >
          {t('detail.qualifications.deleteConfirm')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

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

  const form = useForm<QualificationFormValues>({
    resolver: zodResolver(qualificationSchema),
    defaultValues: {
      type: 'ACADEMIC',
      degreeName: '',
      institution: '',
      boardUniversity: '',
      yearOfPassing: '',
      gradePercentage: '',
    },
  });

  React.useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({
          type: (editing.type as QualificationFormValues['type']) ?? 'ACADEMIC',
          degreeName: editing.degreeName,
          institution: editing.institution ?? '',
          boardUniversity: editing.boardUniversity ?? '',
          yearOfPassing: editing.yearOfPassing ?? '',
          gradePercentage: editing.gradePercentage ?? '',
        });
      } else {
        form.reset({
          type: 'ACADEMIC',
          degreeName: '',
          institution: '',
          boardUniversity: '',
          yearOfPassing: '',
          gradePercentage: '',
        });
      }
    }
  }, [open, editing, form]);

  const onSubmit = form.handleSubmit(async (rawValues) => {
    const values = rawValues as QualificationFormParsed;
    try {
      if (editing) {
        await updateQual({
          variables: {
            id: editing.id,
            input: {
              type: values.type,
              degreeName: values.degreeName,
              institution: values.institution || undefined,
              boardUniversity: values.boardUniversity || undefined,
              yearOfPassing: values.yearOfPassing,
              gradePercentage: values.gradePercentage || undefined,
            },
          },
        });
        toast.success(t('detail.qualifications.updateSuccess'));
      } else {
        await createQual({
          variables: {
            input: {
              staffProfileId,
              type: values.type,
              degreeName: values.degreeName,
              institution: values.institution || undefined,
              boardUniversity: values.boardUniversity || undefined,
              yearOfPassing: values.yearOfPassing,
              gradePercentage: values.gradePercentage || undefined,
            },
          },
        });
        toast.success(t('detail.qualifications.createSuccess'));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('detail.qualifications.dialogEditTitle')
              : t('detail.qualifications.dialogCreateTitle')}
          </DialogTitle>
          <DialogDescription>{t('detail.qualifications.dialogDescription')}</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FieldGroup className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="q-type">{t('detail.qualifications.fields.type')}</FieldLabel>
                <Select
                  value={form.watch('type')}
                  onValueChange={(v) =>
                    form.setValue('type', v as QualificationFormValues['type'], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger id="q-type">
                    <SelectValue placeholder={t('detail.qualifications.fields.typePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {QUALIFICATION_TYPES.map((qt) => (
                      <SelectItem key={qt} value={qt}>
                        {t(`detail.qualifications.types.${qt}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="q-degree">
                  {t('detail.qualifications.fields.degreeName')}
                </FieldLabel>
                <Input
                  id="q-degree"
                  {...form.register('degreeName')}
                  placeholder={t('detail.qualifications.fields.degreeNamePlaceholder')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="q-institution">
                  {t('detail.qualifications.fields.institution')}
                </FieldLabel>
                <Input
                  id="q-institution"
                  {...form.register('institution')}
                  placeholder={t('detail.qualifications.fields.institutionPlaceholder')}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="q-board">
                  {t('detail.qualifications.fields.boardUniversity')}
                </FieldLabel>
                <Input
                  id="q-board"
                  {...form.register('boardUniversity')}
                  placeholder={t('detail.qualifications.fields.boardUniversityPlaceholder')}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="q-year">
                    {t('detail.qualifications.fields.yearOfPassing')}
                  </FieldLabel>
                  <Input
                    id="q-year"
                    type="number"
                    {...form.register('yearOfPassing')}
                    placeholder={t('detail.qualifications.fields.yearOfPassingPlaceholder')}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="q-grade">
                    {t('detail.qualifications.fields.gradePercentage')}
                  </FieldLabel>
                  <Input
                    id="q-grade"
                    {...form.register('gradePercentage')}
                    placeholder={t('detail.qualifications.fields.gradePercentagePlaceholder')}
                  />
                </Field>
              </div>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="min-h-11"
              >
                {t('detail.qualifications.cancel')}
              </Button>
              <Button type="submit" disabled={loading} className="min-h-11">
                {loading ? t('detail.qualifications.saving') : t('detail.qualifications.save')}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
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
