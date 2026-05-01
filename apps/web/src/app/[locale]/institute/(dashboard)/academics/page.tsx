'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { buildI18nTextSchema, useI18nField, zodValidator } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  FieldGroup,
  I18nField,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useAppForm,
} from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { Check, GraduationCap, Layers, List, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { AcademicYearSelector } from '../academic-years/year-selector';
import {
  type Standard,
  useCreateStandard,
  useDeleteStandard,
  useStandards,
  useUpdateStandard,
} from './use-academics';

const { instituteAcademics } = testIds;
const LEVEL_COLORS: Record<string, string> = {
  PRE_PRIMARY: 'bg-pink-100 text-pink-700',
  PRIMARY: 'bg-blue-100 text-blue-700',
  UPPER_PRIMARY: 'bg-indigo-100 text-indigo-700',
  SECONDARY: 'bg-violet-100 text-violet-700',
  SENIOR_SECONDARY: 'bg-purple-100 text-purple-700',
};

const DEPT_COLORS: Record<string, string> = {
  PRE_PRIMARY: 'bg-pink-50 text-pink-600 border-pink-200',
  PRIMARY: 'bg-blue-50 text-blue-600 border-blue-200',
  UPPER_PRIMARY: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  SECONDARY: 'bg-violet-50 text-violet-600 border-violet-200',
  SENIOR_SECONDARY: 'bg-purple-50 text-purple-600 border-purple-200',
};

const LEVEL_VALUES = [
  'PRE_PRIMARY',
  'PRIMARY',
  'UPPER_PRIMARY',
  'SECONDARY',
  'SENIOR_SECONDARY',
] as const;
const NEP_STAGE_VALUES = ['FOUNDATIONAL', 'PREPARATORY', 'MIDDLE', 'SECONDARY'] as const;

type LevelValue = (typeof LEVEL_VALUES)[number];
type NepStageValue = (typeof NEP_STAGE_VALUES)[number];

function buildStandardSchema(t: ReturnType<typeof useTranslations<'academics'>>) {
  return z.object({
    name: buildI18nTextSchema(t('errors.STANDARD_NAME_DUPLICATE')),
    numericOrder: z.number().int().min(0),
    level: z.union([z.enum(LEVEL_VALUES), z.literal('')]),
    nepStage: z.union([z.enum(NEP_STAGE_VALUES), z.literal('')]),
    department: z.union([z.enum(LEVEL_VALUES), z.literal('')]),
    isBoardExamClass: z.boolean(),
    streamApplicable: z.boolean(),
    maxSectionsAllowed: z.number().int().min(0),
    maxStudentsPerSection: z.number().int().min(0),
  });
}

type StandardFormValues = {
  name: Record<string, string>;
  numericOrder: number;
  level: LevelValue | '';
  nepStage: NepStageValue | '';
  department: LevelValue | '';
  isBoardExamClass: boolean;
  streamApplicable: boolean;
  maxSectionsAllowed: number;
  maxStudentsPerSection: number;
};

function emptyToUndefined<T extends string>(value: T | ''): T | undefined {
  return value === '' ? undefined : value;
}

const EMPTY_STANDARD_DEFAULTS: StandardFormValues = {
  name: { en: '', hi: '' },
  numericOrder: 1,
  level: '',
  nepStage: '',
  department: '',
  isBoardExamClass: false,
  streamApplicable: false,
  maxSectionsAllowed: 4,
  maxStudentsPerSection: 40,
};

function applyDuplicateNameError(
  err: unknown,
  fallback: string,
  setNameError: (message: string) => void,
  duplicateMessage: string,
) {
  const msg = extractGraphQLError(err, fallback);
  if (msg.includes('duplicate') || msg.includes('STANDARD_NAME_DUPLICATE')) {
    setNameError(duplicateMessage);
    return;
  }
  toast.error(msg);
}

export default function AcademicsPage() {
  const t = useTranslations('academics');
  const params = useParams();
  const locale = params.locale as string;
  const [yearId] = useQueryState('year', parseAsString);
  const [viewMode, setViewMode] = React.useState<'flat' | 'grouped'>('flat');
  const [editStandard, setEditStandard] = React.useState<Standard | null>(null);
  const [deleteStandard, setDeleteStandard] = React.useState<Standard | null>(null);
  const resolveI18n = useI18nField();
  const { standards, loading } = useStandards(yearId);

  const grouped = standards.reduce<Record<string, Standard[]>>((acc, std) => {
    const dept = std.department ?? 'OTHER';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(std);
    return acc;
  }, {});

  const columnHelper = createColumnHelper<Standard>();

  const columns: ColumnDef<Standard, unknown>[] = [
    columnHelper.accessor('name', {
      header: t('name'),
      cell: ({ row }) => (
        <Link
          href={`/${locale}/institute/academics/${row.original.id}?year=${yearId ?? ''}`}
          className="font-medium text-primary hover:underline"
          data-testid={`academics-standard-${row.original.id}-link`}
        >
          {resolveI18n(row.original.name)}
        </Link>
      ),
    }) as ColumnDef<Standard, unknown>,
    columnHelper.accessor('numericOrder', {
      header: t('numericOrder'),
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    }) as ColumnDef<Standard, unknown>,
    columnHelper.accessor('level', {
      header: t('level'),
      cell: ({ getValue }) => {
        const level = getValue() as string | null;
        if (!level) return '—';
        return (
          <Badge
            variant="secondary"
            className={`text-[10px] border-0 ${LEVEL_COLORS[level] ?? ''}`}
          >
            {t(`levels.${level}` as Parameters<typeof t>[0])}
          </Badge>
        );
      },
    }) as ColumnDef<Standard, unknown>,
    columnHelper.accessor('department', {
      header: t('department'),
      cell: ({ getValue }) => {
        const dept = getValue() as string | null;
        if (!dept) return '—';
        return (
          <Badge variant="outline" className={`text-[10px] ${DEPT_COLORS[dept] ?? ''}`}>
            {t(`levels.${dept}` as Parameters<typeof t>[0])}
          </Badge>
        );
      },
    }) as ColumnDef<Standard, unknown>,
    columnHelper.accessor('isBoardExamClass', {
      header: t('isBoardExam'),
      cell: ({ getValue }) => (getValue() ? <Check className="size-4 text-emerald-600" /> : null),
    }) as ColumnDef<Standard, unknown>,
    columnHelper.accessor('streamApplicable', {
      header: t('streamApplicable'),
      cell: ({ getValue }) => (getValue() ? <Check className="size-4 text-blue-600" /> : null),
    }) as ColumnDef<Standard, unknown>,
    columnHelper.display({
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Can I="update" a="Standard">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('editStandard')}
              onClick={() => setEditStandard(row.original)}
              data-testid={`academics-standard-${row.original.id}-edit-btn`}
            >
              <Pencil className="size-3.5" />
            </Button>
          </Can>
          <Can I="delete" a="Standard">
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('deleteStandard')}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteStandard(row.original)}
              data-testid={`academics-standard-${row.original.id}-delete-btn`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </Can>
        </div>
      ),
    }) as ColumnDef<Standard, unknown>,
  ];

  if (!yearId) {
    return (
      <div className="space-y-6">
        <PageHeader t={t} viewMode={viewMode} setViewMode={setViewMode} yearId={yearId} />
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Layers />
            </EmptyMedia>
            <EmptyTitle>{t('selectYear')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <Can I="read" a="Standard" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <PageHeader t={t} viewMode={viewMode} setViewMode={setViewMode} yearId={yearId} />

            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="size-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : standards.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <GraduationCap />
                  </EmptyMedia>
                  <EmptyTitle>{t('noStandards')}</EmptyTitle>
                  <EmptyDescription>{t('noStandardsDescription')}</EmptyDescription>
                </EmptyHeader>
                <Can I="create" a="Standard">
                  <CreateStandardDialog yearId={yearId} />
                </Can>
              </Empty>
            ) : viewMode === 'flat' ? (
              <DataTable
                columns={columns}
                data={standards}
                data-testid={instituteAcademics.table}
              />
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([dept, stds]) => (
                  <div key={dept} className="rounded-lg border">
                    <div className={`px-4 py-2.5 border-b ${DEPT_COLORS[dept] ?? 'bg-muted'}`}>
                      <h3 className="text-sm font-semibold">
                        {t(`levels.${dept}` as Parameters<typeof t>[0])}
                        <span className="ms-2 text-xs font-normal opacity-70">({stds.length})</span>
                      </h3>
                    </div>
                    <DataTable columns={columns} data={stds} />
                  </div>
                ))}
              </div>
            )}

            {/* Edit Standard Sheet */}
            {editStandard && (
              <EditStandardSheet
                standard={editStandard}
                open={!!editStandard}
                onOpenChange={(open) => !open && setEditStandard(null)}
              />
            )}

            {/* Delete Standard Dialog */}
            <DeleteStandardDialog
              standard={deleteStandard}
              open={!!deleteStandard}
              onOpenChange={(open) => !open && setDeleteStandard(null)}
            />
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

function PageHeader({
  t,
  viewMode,
  setViewMode,
  yearId,
}: {
  t: ReturnType<typeof useTranslations<'academics'>>;
  viewMode: 'flat' | 'grouped';
  setViewMode: (v: 'flat' | 'grouped') => void;
  yearId: string | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          data-testid={instituteAcademics.title}
        >
          {t('title')}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <AcademicYearSelector />
        <div className="flex rounded-md border" data-testid={instituteAcademics.viewToggle}>
          <Button
            variant={viewMode === 'flat' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-e-none gap-1.5"
            onClick={() => setViewMode('flat')}
            data-testid={instituteAcademics.tabFlat}
          >
            <List className="size-3.5" />
            {t('flatView')}
          </Button>
          <Button
            variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-s-none gap-1.5"
            onClick={() => setViewMode('grouped')}
            data-testid={instituteAcademics.tabDepartment}
          >
            <Layers className="size-3.5" />
            {t('groupedView')}
          </Button>
        </div>
        <Can I="create" a="Standard">
          {yearId && <CreateStandardDialog yearId={yearId} />}
        </Can>
      </div>
    </div>
  );
}

function buildLevelOptions(t: ReturnType<typeof useTranslations<'academics'>>) {
  return LEVEL_VALUES.map((l) => ({
    value: l,
    label: t(`levels.${l}` as Parameters<typeof t>[0]),
  }));
}

function buildNepStageOptions(t: ReturnType<typeof useTranslations<'academics'>>) {
  return NEP_STAGE_VALUES.map((s) => ({
    value: s,
    label: t(`nepStages.${s}` as Parameters<typeof t>[0]),
  }));
}

function CreateStandardDialog({ yearId }: { yearId: string }) {
  const t = useTranslations('academics');
  const { createStandard, loading } = useCreateStandard();
  const [open, setOpen] = React.useState(false);

  const schema = React.useMemo(() => buildStandardSchema(t), [t]);
  const levelOptions = buildLevelOptions(t);
  const nepStageOptions = buildNepStageOptions(t);

  const form = useAppForm({
    defaultValues: EMPTY_STANDARD_DEFAULTS,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        await createStandard({
          academicYearId: yearId,
          name: parsed.name,
          numericOrder: parsed.numericOrder,
          level: emptyToUndefined(parsed.level),
          nepStage: emptyToUndefined(parsed.nepStage),
          department: emptyToUndefined(parsed.department),
          isBoardExamClass: parsed.isBoardExamClass,
          streamApplicable: parsed.streamApplicable,
          maxSectionsAllowed: parsed.maxSectionsAllowed || undefined,
          maxStudentsPerSection: parsed.maxStudentsPerSection || undefined,
        });
        toast.success(t('created'));
        setOpen(false);
        form.reset();
      } catch (err) {
        applyDuplicateNameError(
          err,
          t('errors.STANDARD_NAME_DUPLICATE'),
          (message) => {
            form.setFieldMeta('name.en', (prev) => ({
              ...prev,
              isTouched: true,
              errorMap: { ...prev.errorMap, onSubmit: message },
            }));
          },
          t('errors.STANDARD_NAME_DUPLICATE'),
        );
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" data-testid={instituteAcademics.newBtn}>
          <Plus className="size-4" />
          {t('createStandard')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createStandard')}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <FieldGroup>
            <I18nField
              form={form}
              name="name"
              label={t('name')}
              placeholder="e.g. Class 5"
              testId="academics-standard-name-input"
            />
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="numericOrder">
                {(field) => (
                  <field.NumberField
                    label={t('numericOrder')}
                    testId="academics-standard-numeric-order-input"
                    min={0}
                  />
                )}
              </form.AppField>
              <form.AppField name="department">
                {(field) => (
                  <field.SelectField
                    label={t('department')}
                    options={levelOptions}
                    testId="academics-standard-department-select"
                  />
                )}
              </form.AppField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="level">
                {(field) => (
                  <field.SelectField
                    label={t('level')}
                    options={levelOptions}
                    testId="academics-standard-level-select"
                  />
                )}
              </form.AppField>
              <form.AppField name="nepStage">
                {(field) => (
                  <field.SelectField
                    label={t('nepStage')}
                    options={nepStageOptions}
                    testId="academics-standard-nep-stage-select"
                  />
                )}
              </form.AppField>
            </div>
            <div className="flex items-center gap-6">
              <form.AppField name="isBoardExamClass">
                {(field) => (
                  <field.SwitchField
                    label={t('isBoardExam')}
                    testId="academics-standard-is-board-exam-switch"
                  />
                )}
              </form.AppField>
              <form.AppField name="streamApplicable">
                {(field) => (
                  <field.SwitchField
                    label={t('streamApplicable')}
                    testId="academics-standard-stream-applicable-switch"
                  />
                )}
              </form.AppField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="maxSectionsAllowed">
                {(field) => (
                  <field.NumberField
                    label={t('maxSections')}
                    testId="academics-standard-max-sections-input"
                    min={0}
                  />
                )}
              </form.AppField>
              <form.AppField name="maxStudentsPerSection">
                {(field) => (
                  <field.NumberField
                    label={t('maxStudents')}
                    testId="academics-standard-max-students-input"
                    min={0}
                  />
                )}
              </form.AppField>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid={instituteAcademics.standardCreateCancelBtn}
            >
              {t('cancel')}
            </Button>
            <form.AppForm>
              <form.SubmitButton
                disabled={loading}
                submittingLabel={t('creating')}
                testId="academics-standard-create-submit-btn"
              >
                {t('createStandard')}
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditStandardSheet({
  standard,
  open,
  onOpenChange,
}: {
  standard: Standard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('academics');
  const { updateStandard, loading } = useUpdateStandard();

  const schema = React.useMemo(() => buildStandardSchema(t), [t]);
  const levelOptions = buildLevelOptions(t);
  const nepStageOptions = buildNepStageOptions(t);

  const buildDefaults = React.useCallback((s: Standard): StandardFormValues => {
    const name = (s.name ?? {}) as Record<string, string>;
    return {
      name: { en: name.en ?? '', hi: name.hi ?? '' },
      numericOrder: s.numericOrder,
      level: ((s.level as LevelValue | null) ?? '') as LevelValue | '',
      nepStage: ((s.nepStage as NepStageValue | null) ?? '') as NepStageValue | '',
      department: ((s.department as LevelValue | null) ?? '') as LevelValue | '',
      isBoardExamClass: s.isBoardExamClass,
      streamApplicable: s.streamApplicable,
      maxSectionsAllowed: s.maxSectionsAllowed ?? 4,
      maxStudentsPerSection: s.maxStudentsPerSection ?? 40,
    };
  }, []);

  const form = useAppForm({
    defaultValues: buildDefaults(standard),
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        await updateStandard(standard.id, {
          name: parsed.name,
          numericOrder: parsed.numericOrder,
          level: emptyToUndefined(parsed.level),
          nepStage: emptyToUndefined(parsed.nepStage),
          department: emptyToUndefined(parsed.department),
          isBoardExamClass: parsed.isBoardExamClass,
          streamApplicable: parsed.streamApplicable,
          maxSectionsAllowed: parsed.maxSectionsAllowed || undefined,
          maxStudentsPerSection: parsed.maxStudentsPerSection || undefined,
        });
        toast.success(t('updated'));
        onOpenChange(false);
      } catch (err) {
        applyDuplicateNameError(
          err,
          t('errors.STANDARD_NAME_DUPLICATE'),
          (message) => {
            form.setFieldMeta('name.en', (prev) => ({
              ...prev,
              isTouched: true,
              errorMap: { ...prev.errorMap, onSubmit: message },
            }));
          },
          t('errors.STANDARD_NAME_DUPLICATE'),
        );
      }
    },
  });

  React.useEffect(() => {
    form.reset(buildDefaults(standard));
  }, [standard, form, buildDefaults]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('editStandard')}</SheetTitle>
        </SheetHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4 mt-4"
        >
          <FieldGroup>
            <I18nField
              form={form}
              name="name"
              label={t('name')}
              placeholder="e.g. Class 5"
              testId="academics-standard-name-input"
            />
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="numericOrder">
                {(field) => (
                  <field.NumberField
                    label={t('numericOrder')}
                    testId="academics-standard-numeric-order-input"
                    min={0}
                  />
                )}
              </form.AppField>
              <form.AppField name="department">
                {(field) => (
                  <field.SelectField
                    label={t('department')}
                    options={levelOptions}
                    testId="academics-standard-department-select"
                  />
                )}
              </form.AppField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="level">
                {(field) => (
                  <field.SelectField
                    label={t('level')}
                    options={levelOptions}
                    testId="academics-standard-level-select"
                  />
                )}
              </form.AppField>
              <form.AppField name="nepStage">
                {(field) => (
                  <field.SelectField
                    label={t('nepStage')}
                    options={nepStageOptions}
                    testId="academics-standard-nep-stage-select"
                  />
                )}
              </form.AppField>
            </div>
            <div className="flex items-center gap-6">
              <form.AppField name="isBoardExamClass">
                {(field) => (
                  <field.SwitchField
                    label={t('isBoardExam')}
                    testId="academics-standard-is-board-exam-switch"
                  />
                )}
              </form.AppField>
              <form.AppField name="streamApplicable">
                {(field) => (
                  <field.SwitchField
                    label={t('streamApplicable')}
                    testId="academics-standard-stream-applicable-switch"
                  />
                )}
              </form.AppField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="maxSectionsAllowed">
                {(field) => (
                  <field.NumberField
                    label={t('maxSections')}
                    testId="academics-standard-max-sections-input"
                    min={0}
                  />
                )}
              </form.AppField>
              <form.AppField name="maxStudentsPerSection">
                {(field) => (
                  <field.NumberField
                    label={t('maxStudents')}
                    testId="academics-standard-max-students-input"
                    min={0}
                  />
                )}
              </form.AppField>
            </div>
          </FieldGroup>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid={instituteAcademics.standardEditCancelBtn}
            >
              {t('cancel')}
            </Button>
            <form.AppForm>
              <form.SubmitButton
                disabled={loading}
                submittingLabel={t('saving')}
                testId="academics-standard-edit-submit-btn"
              >
                {t('saveChanges')}
              </form.SubmitButton>
            </form.AppForm>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DeleteStandardDialog({
  standard,
  open,
  onOpenChange,
}: {
  standard: Standard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('academics');
  const resolveI18n = useI18nField();
  const { deleteStandard, loading } = useDeleteStandard();

  const handleDelete = async () => {
    if (!standard) return;
    try {
      await deleteStandard(standard.id);
      toast.success(t('deleted'));
      onOpenChange(false);
    } catch (err) {
      const msg = extractGraphQLError(err, t('errors.HAS_ACTIVE_ENROLLMENTS'));
      if (msg.includes('HAS_ACTIVE_ENROLLMENTS')) {
        toast.error(t('errors.HAS_ACTIVE_ENROLLMENTS'));
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t('deleteConfirmTitle', { name: resolveI18n(standard?.name) ?? '' })}
          </DialogTitle>
          <DialogDescription>
            {t('deleteConfirmDescription', { name: resolveI18n(standard?.name) ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid={instituteAcademics.standardDeleteCancelBtn}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={loading}
            onClick={handleDelete}
            data-testid={instituteAcademics.standardDeleteConfirmBtn}
          >
            {loading ? t('deleting') : t('deleteStandard')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
