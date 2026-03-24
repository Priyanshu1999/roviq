'use client';

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
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
} from '@roviq/ui';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { Check, GraduationCap, Layers, List, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { AcademicYearSelector } from '../academic-years/year-selector';
import {
  type Standard,
  useCreateStandard,
  useDeleteStandard,
  useStandards,
  useUpdateStandard,
} from './use-academics';

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

export default function AcademicsPage() {
  const t = useTranslations('academics');
  const params = useParams();
  const locale = params.locale as string;
  const [yearId] = useQueryState('year', parseAsString);
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat');
  const [editStandard, setEditStandard] = useState<Standard | null>(null);
  const [deleteStandard, setDeleteStandard] = useState<Standard | null>(null);
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
        >
          {row.original.name}
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
            <Button variant="ghost" size="sm" onClick={() => setEditStandard(row.original)}>
              <Pencil className="size-3.5" />
            </Button>
          </Can>
          <Can I="delete" a="Standard">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteStandard(row.original)}
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
              <DataTable columns={columns} data={standards} />
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
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      </div>
      <div className="flex items-center gap-3">
        <AcademicYearSelector />
        <div className="flex rounded-md border">
          <Button
            variant={viewMode === 'flat' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-e-none gap-1.5"
            onClick={() => setViewMode('flat')}
          >
            <List className="size-3.5" />
            {t('flatView')}
          </Button>
          <Button
            variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
            size="sm"
            className="rounded-s-none gap-1.5"
            onClick={() => setViewMode('grouped')}
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

function CreateStandardDialog({ yearId }: { yearId: string }) {
  const t = useTranslations('academics');
  const { createStandard, loading } = useCreateStandard();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      name: '',
      numericOrder: 1,
      level: '',
      nepStage: '',
      department: '',
      isBoardExamClass: false,
      streamApplicable: false,
      maxSectionsAllowed: 4,
      maxStudentsPerSection: 40,
    },
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      await createStandard({
        academicYearId: yearId,
        name: data.name,
        numericOrder: Number(data.numericOrder),
        level: data.level || undefined,
        nepStage: data.nepStage || undefined,
        department: data.department || undefined,
        isBoardExamClass: data.isBoardExamClass,
        streamApplicable: data.streamApplicable,
        maxSectionsAllowed: Number(data.maxSectionsAllowed) || undefined,
        maxStudentsPerSection: Number(data.maxStudentsPerSection) || undefined,
      });
      toast.success(t('created'));
      setOpen(false);
      form.reset();
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('duplicate') || msg.includes('STANDARD_NAME_DUPLICATE')) {
        form.setError('name' as never, { message: t('errors.STANDARD_NAME_DUPLICATE') });
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="size-4" />
          {t('createStandard')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createStandard')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>{t('name')}</FieldLabel>
              <Input placeholder="e.g. Class 5" {...form.register('name', { required: true })} />
              {form.formState.errors.name && (
                <FieldError>
                  {(form.formState.errors.name as { message?: string }).message}
                </FieldError>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('numericOrder')}</FieldLabel>
                <Input type="number" {...form.register('numericOrder', { valueAsNumber: true })} />
              </Field>
              <Field>
                <FieldLabel>{t('department')}</FieldLabel>
                <Select
                  value={form.watch('department')}
                  onValueChange={(v) => form.setValue('department', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'PRE_PRIMARY',
                      'PRIMARY',
                      'UPPER_PRIMARY',
                      'SECONDARY',
                      'SENIOR_SECONDARY',
                    ].map((d) => (
                      <SelectItem key={d} value={d}>
                        {t(`levels.${d}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('level')}</FieldLabel>
                <Select
                  value={form.watch('level')}
                  onValueChange={(v) => form.setValue('level', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'PRE_PRIMARY',
                      'PRIMARY',
                      'UPPER_PRIMARY',
                      'SECONDARY',
                      'SENIOR_SECONDARY',
                    ].map((l) => (
                      <SelectItem key={l} value={l}>
                        {t(`levels.${l}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('nepStage')}</FieldLabel>
                <Select
                  value={form.watch('nepStage')}
                  onValueChange={(v) => form.setValue('nepStage', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['FOUNDATIONAL', 'PREPARATORY', 'MIDDLE', 'SECONDARY'].map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`nepStages.${s}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.watch('isBoardExamClass')}
                  onCheckedChange={(v) => form.setValue('isBoardExamClass', v)}
                />
                {t('isBoardExam')}
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.watch('streamApplicable')}
                  onCheckedChange={(v) => form.setValue('streamApplicable', v)}
                />
                {t('streamApplicable')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('maxSections')}</FieldLabel>
                <Input
                  type="number"
                  {...form.register('maxSectionsAllowed', { valueAsNumber: true })}
                />
              </Field>
              <Field>
                <FieldLabel>{t('maxStudents')}</FieldLabel>
                <Input
                  type="number"
                  {...form.register('maxStudentsPerSection', { valueAsNumber: true })}
                />
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('creating') : t('createStandard')}
            </Button>
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

  const form = useForm({
    defaultValues: {
      name: standard.name,
      numericOrder: standard.numericOrder,
      level: standard.level ?? '',
      nepStage: standard.nepStage ?? '',
      department: standard.department ?? '',
      isBoardExamClass: standard.isBoardExamClass,
      streamApplicable: standard.streamApplicable,
      maxSectionsAllowed: standard.maxSectionsAllowed ?? 4,
      maxStudentsPerSection: standard.maxStudentsPerSection ?? 40,
    },
  });

  useEffect(() => {
    form.reset({
      name: standard.name,
      numericOrder: standard.numericOrder,
      level: standard.level ?? '',
      nepStage: standard.nepStage ?? '',
      department: standard.department ?? '',
      isBoardExamClass: standard.isBoardExamClass,
      streamApplicable: standard.streamApplicable,
      maxSectionsAllowed: standard.maxSectionsAllowed ?? 4,
      maxStudentsPerSection: standard.maxStudentsPerSection ?? 40,
    });
  }, [standard, form]);

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      await updateStandard(standard.id, {
        name: data.name,
        numericOrder: Number(data.numericOrder),
        level: data.level || undefined,
        nepStage: data.nepStage || undefined,
        department: data.department || undefined,
        isBoardExamClass: data.isBoardExamClass,
        streamApplicable: data.streamApplicable,
        maxSectionsAllowed: Number(data.maxSectionsAllowed) || undefined,
        maxStudentsPerSection: Number(data.maxStudentsPerSection) || undefined,
      });
      toast.success(t('updated'));
      onOpenChange(false);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('duplicate') || msg.includes('STANDARD_NAME_DUPLICATE')) {
        form.setError('name' as never, { message: t('errors.STANDARD_NAME_DUPLICATE') });
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('editStandard')}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
          <FieldGroup>
            <Field>
              <FieldLabel>{t('name')}</FieldLabel>
              <Input placeholder="e.g. Class 5" {...form.register('name', { required: true })} />
              {form.formState.errors.name && (
                <FieldError>
                  {(form.formState.errors.name as { message?: string }).message}
                </FieldError>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('numericOrder')}</FieldLabel>
                <Input type="number" {...form.register('numericOrder', { valueAsNumber: true })} />
              </Field>
              <Field>
                <FieldLabel>{t('department')}</FieldLabel>
                <Select
                  value={form.watch('department')}
                  onValueChange={(v) => form.setValue('department', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'PRE_PRIMARY',
                      'PRIMARY',
                      'UPPER_PRIMARY',
                      'SECONDARY',
                      'SENIOR_SECONDARY',
                    ].map((d) => (
                      <SelectItem key={d} value={d}>
                        {t(`levels.${d}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('level')}</FieldLabel>
                <Select
                  value={form.watch('level')}
                  onValueChange={(v) => form.setValue('level', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'PRE_PRIMARY',
                      'PRIMARY',
                      'UPPER_PRIMARY',
                      'SECONDARY',
                      'SENIOR_SECONDARY',
                    ].map((l) => (
                      <SelectItem key={l} value={l}>
                        {t(`levels.${l}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('nepStage')}</FieldLabel>
                <Select
                  value={form.watch('nepStage')}
                  onValueChange={(v) => form.setValue('nepStage', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['FOUNDATIONAL', 'PREPARATORY', 'MIDDLE', 'SECONDARY'].map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`nepStages.${s}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.watch('isBoardExamClass')}
                  onCheckedChange={(v) => form.setValue('isBoardExamClass', v)}
                />
                {t('isBoardExam')}
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.watch('streamApplicable')}
                  onCheckedChange={(v) => form.setValue('streamApplicable', v)}
                />
                {t('streamApplicable')}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('maxSections')}</FieldLabel>
                <Input
                  type="number"
                  {...form.register('maxSectionsAllowed', { valueAsNumber: true })}
                />
              </Field>
              <Field>
                <FieldLabel>{t('maxStudents')}</FieldLabel>
                <Input
                  type="number"
                  {...form.register('maxStudentsPerSection', { valueAsNumber: true })}
                />
              </Field>
            </div>
          </FieldGroup>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('saving') : t('saveChanges')}
            </Button>
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
  const { deleteStandard, loading } = useDeleteStandard();

  const handleDelete = async () => {
    if (!standard) return;
    try {
      await deleteStandard(standard.id);
      toast.success(t('deleted'));
      onOpenChange(false);
    } catch (err) {
      const msg = (err as Error).message;
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
          <DialogTitle>{t('deleteConfirmTitle', { name: standard?.name ?? '' })}</DialogTitle>
          <DialogDescription>
            {t('deleteConfirmDescription', { name: standard?.name ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" disabled={loading} onClick={handleDelete}>
            {loading ? t('deleting') : t('deleteStandard')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
