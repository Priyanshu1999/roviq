'use client';

import {
  GUARDIAN_EDUCATION_LEVEL_VALUES,
  GUARDIAN_RELATIONSHIP_VALUES,
  GuardianEducationLevel,
  type GuardianRelationship,
} from '@roviq/common-types';
import {
  buildI18nTextSchema,
  emptyStringToUndefined,
  useFormatDate,
  useI18nField,
  useRouter,
  zodValidator,
} from '@roviq/i18n';
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
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
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
  useAppForm,
  useBreadcrumbOverride,
} from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import { useStore } from '@tanstack/react-form';
import { useDebouncedValue } from '@web/hooks/use-debounced-value';
import { useFormDraft } from '@web/hooks/use-form-draft';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronsUpDown,
  History,
  Loader2,
  Plus,
  UserRound,
  Users,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  type GuardianDetailNode,
  type LinkedStudentNode,
  type StudentPickerNode,
  useConsentStatusForStudent,
  useGuardian,
  useGuardianLinkedStudents,
  useLinkGuardianToStudent,
  useStudentsForGuardianPicker,
  useUpdateGuardian,
} from '../use-guardians';

const { instituteGuardians } = testIds;
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
        <Button variant="ghost" size="sm" onClick={() => router.push('/people/guardians')}>
          <ArrowLeft className="size-4" />
          {t('detail.back')}
        </Button>
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle data-testid={instituteGuardians.detailNotFoundTitle}>
              {t('detail.notFound')}
            </EmptyTitle>
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
                    <TabsTrigger value="profile" data-testid={instituteGuardians.detailTabProfile}>
                      <UserRound className="size-4" />
                      {t('detail.tabs.profile')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="children"
                      data-testid={instituteGuardians.detailTabChildren}
                    >
                      <Users className="size-4" />
                      {t('detail.tabs.children')}
                    </TabsTrigger>
                    <TabsTrigger value="audit" data-testid={instituteGuardians.detailTabAudit}>
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
            <div data-testid={instituteGuardians.detailTitle} className="text-lg font-semibold">
              {fullName}
            </div>
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

  const form = useAppForm({
    defaultValues,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
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
        clearDraft();
        // Reset dirty flag so the Save button re-disables.
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

  const { clearDraft } = useFormDraft<GuardianProfileFormValues>({
    key: `guardian-profile:${guardian.id}`,
    form,
    enabled: !loading,
  });

  // Drive the submit-button disabled state without re-rendering the whole
  // tab on every keystroke.
  const isDirty = useStore(form.store, (state) => state.isDirty);

  const educationLevelOptions = GUARDIAN_EDUCATION_LEVEL_VALUES.map((value) => ({
    value,
    label: t(`new.educationLevels.${value}`),
  }));

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
              <I18nField form={form} name="firstName" label={t('detail.profile.firstName')} />
              <I18nField form={form} name="lastName" label={t('detail.profile.lastName')} />
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>{t('detail.profile.occupation')}</FieldLegend>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <form.AppField name="occupation">
                {(field) => (
                  <field.TextField
                    label={t('detail.profile.occupation')}
                    testId="guardian-detail-occupation-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="organization">
                {(field) => <field.TextField label={t('detail.profile.organization')} />}
              </form.AppField>

              <form.AppField name="designation">
                {(field) => <field.TextField label={t('detail.profile.designation')} />}
              </form.AppField>

              <form.AppField name="educationLevel">
                {(field) => (
                  <field.SelectField
                    label={t('detail.profile.educationLevel')}
                    options={educationLevelOptions}
                    placeholder={t('new.placeholders.educationLevel')}
                    testId="guardian-detail-education-level-select"
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </FieldSet>

          <div className="flex items-center justify-end gap-2">
            <form.AppForm>
              <form.SubmitButton
                testId="guardian-detail-save-btn"
                disabled={saving || !isDirty}
                submittingLabel={t('detail.profile.saving')}
              >
                {saving ? t('detail.profile.saving') : t('detail.profile.save')}
              </form.SubmitButton>
            </form.AppForm>
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
  const [linkDialogOpen, setLinkDialogOpen] = React.useState(false);
  const linkedStudentIds = React.useMemo(
    () => new Set(linked.map((l) => l.studentProfileId)),
    [linked],
  );

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

  // Backend guards `linkGuardianToStudent` with `update Guardian` — gate
  // the CTA the same way so read-only roles never see a button that would
  // throw a 403.
  const linkButton = (
    <Can I="update" a="Guardian">
      <Button
        size="sm"
        onClick={() => setLinkDialogOpen(true)}
        data-testid={instituteGuardians.detailLinkStudentBtn}
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('detail.children.linkButton')}
      </Button>
    </Can>
  );

  const linkDialog = (
    <LinkStudentDialog
      guardianId={guardianId}
      open={linkDialogOpen}
      onOpenChange={setLinkDialogOpen}
      excludeStudentIds={linkedStudentIds}
    />
  );

  if (linked.length === 0) {
    return (
      <>
        <div className="flex justify-end">{linkButton}</div>
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{t('detail.children.empty')}</EmptyTitle>
            <EmptyDescription>{t('detail.children.emptyDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
        {linkDialog}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('detail.children.count', { count: linked.length })}
        </span>
        {linkButton}
      </div>
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
      {linkDialog}
    </div>
  );
}

// ─── Link Student dialog ─────────────────────────────────────────────────

interface LinkStudentDialogProps {
  guardianId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  excludeStudentIds: Set<string>;
}

function LinkStudentDialog({
  guardianId,
  open,
  onOpenChange,
  excludeStudentIds,
}: LinkStudentDialogProps) {
  const t = useTranslations('guardians');
  const resolveI18nName = useI18nField();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [studentId, setStudentId] = React.useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = React.useState<StudentPickerNode | null>(null);
  const [relationship, setRelationship] = React.useState<GuardianRelationship | ''>('');
  const [isPrimaryContact, setIsPrimaryContact] = React.useState(false);
  const [isEmergencyContact, setIsEmergencyContact] = React.useState(false);
  const [canPickup, setCanPickup] = React.useState(true);
  const [livesWith, setLivesWith] = React.useState(true);

  // `skip: !open` — picker stays idle until the user opens the dialog.
  const { data, loading } = useStudentsForGuardianPicker(debouncedSearch, { skip: !open });
  const [linkMutation, { loading: linking }] = useLinkGuardianToStudent();

  const options = (data?.listStudents.edges.map((e) => e.node) ?? []).filter(
    (s) => !excludeStudentIds.has(s.id),
  );

  // Reset on close
  React.useEffect(() => {
    if (!open) {
      setSearch('');
      setStudentId(null);
      setSelectedStudent(null);
      setRelationship('');
      setIsPrimaryContact(false);
      setIsEmergencyContact(false);
      setCanPickup(true);
      setLivesWith(true);
    }
  }, [open]);

  const canSubmit = studentId !== null && relationship !== '' && !linking;

  async function handleSubmit() {
    if (!studentId || !relationship) return;
    try {
      await linkMutation({
        variables: {
          input: {
            guardianProfileId: guardianId,
            studentProfileId: studentId,
            relationship,
            isPrimaryContact,
            isEmergencyContact,
            canPickup,
            livesWith,
          },
        },
      });
      toast.success(t('detail.children.linkDialog.linked'));
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const selectedStudentLabel = selectedStudent
    ? [resolveI18nName(selectedStudent.firstName), resolveI18nName(selectedStudent.lastName)]
        .filter(Boolean)
        .join(' ') +
      (selectedStudent.admissionNumber ? ` (${selectedStudent.admissionNumber})` : '')
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        data-testid={instituteGuardians.detailLinkStudentDialog}
      >
        <DialogHeader>
          <DialogTitle>{t('detail.children.linkDialog.title')}</DialogTitle>
          <DialogDescription>{t('detail.children.linkDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field>
            <FieldLabel>{t('detail.children.linkDialog.studentLabel')}</FieldLabel>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  aria-label={t('detail.children.linkDialog.studentLabel')}
                  className="w-full justify-between font-normal"
                  data-testid={instituteGuardians.detailLinkStudentPickerTrigger}
                >
                  <span className={selectedStudent ? '' : 'text-muted-foreground'}>
                    {selectedStudentLabel || t('detail.children.linkDialog.studentPlaceholder')}
                  </span>
                  {loading ? (
                    <Loader2 className="size-4 animate-spin opacity-50" />
                  ) : (
                    <ChevronsUpDown className="size-4 opacity-50" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={t('detail.children.linkDialog.searchPlaceholder')}
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList aria-label={t('detail.children.linkDialog.studentLabel')}>
                    {options.length === 0 ? (
                      // Render a disabled `role="option"` item instead of
                      // `CommandEmpty` so the `role="listbox"` always has at
                      // least one child with the required role (satisfies the
                      // axe `aria-required-children` rule). `disabled` + the
                      // `data-empty` sentinel keep it non-selectable and
                      // visually identical to the old empty-state text.
                      <CommandItem
                        disabled
                        value="__empty__"
                        data-empty="true"
                        data-testid={instituteGuardians.detailLinkStudentEmpty}
                        className="justify-center text-sm text-muted-foreground data-[empty=true]:[&_svg]:hidden"
                      >
                        {loading
                          ? t('detail.children.linkDialog.searchLoading')
                          : t('detail.children.linkDialog.searchNoResults')}
                      </CommandItem>
                    ) : (
                      <CommandGroup>
                        {options.map((option) => {
                          const name = [
                            resolveI18nName(option.firstName),
                            resolveI18nName(option.lastName),
                          ]
                            .filter(Boolean)
                            .join(' ');
                          const placement = [
                            option.currentStandardName
                              ? resolveI18nName(option.currentStandardName)
                              : '',
                            option.currentSectionName
                              ? resolveI18nName(option.currentSectionName)
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' · ');
                          return (
                            <CommandItem
                              key={option.id}
                              value={option.id}
                              onSelect={() => {
                                setStudentId(option.id);
                                setSelectedStudent(option);
                                setPickerOpen(false);
                              }}
                              data-testid={`guardian-detail-link-student-option-${option.id}`}
                            >
                              <Check
                                className={`mr-2 size-4 ${
                                  studentId === option.id ? 'opacity-100' : 'opacity-0'
                                }`}
                                aria-hidden="true"
                              />
                              <div className="flex min-w-0 flex-col">
                                <span className="truncate">{name}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                  {option.admissionNumber}
                                  {placement ? ` · ${placement}` : ''}
                                </span>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </Field>

          <Field>
            <FieldLabel>{t('detail.children.linkDialog.relationshipLabel')}</FieldLabel>
            <Select
              value={relationship || undefined}
              onValueChange={(v) => setRelationship(v as GuardianRelationship)}
            >
              <SelectTrigger
                aria-label={t('detail.children.linkDialog.relationshipLabel')}
                data-testid={instituteGuardians.detailLinkStudentRelationshipSelect}
              >
                <SelectValue
                  placeholder={t('detail.children.linkDialog.relationshipPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {GUARDIAN_RELATIONSHIP_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`detail.children.relationships.${value}`, { default: value })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <LinkToggle
              id="link-is-primary"
              label={t('detail.children.linkDialog.isPrimaryContact')}
              checked={isPrimaryContact}
              onCheckedChange={setIsPrimaryContact}
            />
            <LinkToggle
              id="link-is-emergency"
              label={t('detail.children.linkDialog.isEmergencyContact')}
              checked={isEmergencyContact}
              onCheckedChange={setIsEmergencyContact}
            />
            <LinkToggle
              id="link-can-pickup"
              label={t('detail.children.linkDialog.canPickup')}
              checked={canPickup}
              onCheckedChange={setCanPickup}
            />
            <LinkToggle
              id="link-lives-with"
              label={t('detail.children.linkDialog.livesWith')}
              checked={livesWith}
              onCheckedChange={setLivesWith}
            />
          </div>

          {isPrimaryContact && (
            <div
              className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
              role="alert"
              data-testid={instituteGuardians.detailLinkStudentPrimaryWarning}
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{t('detail.children.linkDialog.primaryWarning')}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={linking}>
            {t('detail.children.linkDialog.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid={instituteGuardians.detailLinkStudentSubmit}
          >
            {linking
              ? t('detail.children.linkDialog.submitting')
              : t('detail.children.linkDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkToggle({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <FieldLabel htmlFor={id} className="cursor-pointer">
        {label}
      </FieldLabel>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
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
