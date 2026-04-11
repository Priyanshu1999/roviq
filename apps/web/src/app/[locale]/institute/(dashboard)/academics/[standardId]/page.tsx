'use client';

import type { StreamObject } from '@roviq/graphql/generated';
import {
  Badge,
  Button,
  Can,
  CapacityBar,
  DataTable,
  Dialog,
  DialogContent,
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
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@roviq/ui';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { ArrowLeft, BookOpen, Check, Download, Layers, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  type Section,
  type Standard,
  type Subject,
  useCreateSection,
  useCreateSubject,
  useSections,
  useStandards,
  useSubjectsByStandard,
} from '../use-academics';

const SUBJECT_TYPE_COLORS: Record<string, string> = {
  ACADEMIC: 'bg-blue-100 text-blue-700',
  LANGUAGE: 'bg-emerald-100 text-emerald-700',
  SKILL: 'bg-amber-100 text-amber-700',
  EXTRACURRICULAR: 'bg-pink-100 text-pink-700',
  INTERNAL_ASSESSMENT: 'bg-zinc-100 text-zinc-600',
};

const GENDER_COLORS: Record<string, string> = {
  CO_ED: 'bg-green-100 text-green-700',
  BOYS_ONLY: 'bg-sky-100 text-sky-700',
  GIRLS_ONLY: 'bg-pink-100 text-pink-700',
};

export default function StandardDetailPage() {
  const t = useTranslations('academics');
  const params = useParams();
  const locale = params.locale as string;
  const standardId = params.standardId as string;
  const [yearId] = useQueryState('year', parseAsString);

  const { standards } = useStandards(yearId);
  const standard = standards.find((s) => s.id === standardId) ?? null;

  const { sections, loading: sectionsLoading } = useSections(standardId);
  const { subjects, loading: subjectsLoading } = useSubjectsByStandard(standardId);

  return (
    <Can I="read" a="Standard" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
              <Link
                href={`/${locale}/institute/academics?year=${yearId ?? ''}`}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                {t('back')}
              </Link>
              <div className="flex-1">
                <h1 className="text-2xl font-semibold tracking-tight">{standard?.name ?? '...'}</h1>
                {standard && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {standard.level && t(`levels.${standard.level}` as Parameters<typeof t>[0])}
                    {standard.department &&
                      ` · ${t(`levels.${standard.department}` as Parameters<typeof t>[0])}`}
                    {standard.streamApplicable && ` · ${t('streamApplicable')}`}
                  </p>
                )}
              </div>
            </div>

            {/* Tabs: Sections + Subjects */}
            <Tabs defaultValue="sections">
              <TabsList>
                <TabsTrigger value="sections" className="gap-1.5">
                  <Users className="size-3.5" />
                  {t('sections')} ({sections.length})
                </TabsTrigger>
                <TabsTrigger value="subjects" className="gap-1.5">
                  <BookOpen className="size-3.5" />
                  {t('subjects')} ({subjects.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sections" className="mt-4">
                <SectionsTab
                  sections={sections}
                  loading={sectionsLoading}
                  standardId={standardId}
                  standard={standard}
                  t={t}
                />
              </TabsContent>

              <TabsContent value="subjects" className="mt-4">
                <SubjectsTab
                  subjects={subjects}
                  loading={subjectsLoading}
                  standardId={standardId}
                  t={t}
                />
              </TabsContent>
            </Tabs>

            {/* Audit timeline placeholder — wire to audit log query when available */}
            <Can I="read" a="AuditLog">
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-4">{t('auditTimeline')}</h2>
                <p className="text-sm text-muted-foreground">{t('auditTimeline')}</p>
              </div>
            </Can>
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

// ── Sections Tab ──

function SectionsTab({
  sections,
  loading,
  standardId,
  standard,
  t,
}: {
  sections: Section[];
  loading: boolean;
  standardId: string;
  standard: Standard | null;
  t: ReturnType<typeof useTranslations<'academics'>>;
}) {
  const sectionColumnHelper = createColumnHelper<Section>();

  const sectionColumns: ColumnDef<Section, unknown>[] = [
    sectionColumnHelper.accessor('name', {
      header: t('name'),
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }) as ColumnDef<Section, unknown>,
    sectionColumnHelper.accessor('displayLabel', {
      header: t('displayLabel'),
    }) as ColumnDef<Section, unknown>,
    sectionColumnHelper.accessor('stream', {
      header: t('stream'),
      cell: ({ getValue }) => {
        const stream = getValue() as StreamObject | null;
        if (!stream) return '—';
        return (
          <Badge variant="secondary" className="text-[10px]">
            {stream.name}
          </Badge>
        );
      },
    }) as ColumnDef<Section, unknown>,
    sectionColumnHelper.accessor('mediumOfInstruction', {
      header: t('medium'),
      cell: ({ getValue }) => getValue() ?? '—',
    }) as ColumnDef<Section, unknown>,
    sectionColumnHelper.accessor('genderRestriction', {
      header: t('genderRestriction'),
      cell: ({ getValue }) => {
        const gender = getValue() as string;
        return (
          <Badge
            variant="secondary"
            className={`text-[10px] border-0 ${GENDER_COLORS[gender] ?? ''}`}
          >
            {t(`genderOptions.${gender}` as Parameters<typeof t>[0])}
          </Badge>
        );
      },
    }) as ColumnDef<Section, unknown>,
    sectionColumnHelper.accessor('classTeacherId', {
      header: t('classTeacher'),
      cell: ({ getValue }) => {
        const teacherId = getValue() as string | null;
        return teacherId ? (
          <Badge variant="secondary" className="text-[10px]">
            {t('assignTeacher')}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">&mdash;</span>
        );
      },
    }) as ColumnDef<Section, unknown>,
    sectionColumnHelper.display({
      id: 'strength',
      header: t('currentStrength'),
      cell: ({ row }) => (
        <CapacityBar
          current={row.original.currentStrength}
          capacity={row.original.capacity ?? 40}
          hardMax={45}
          className="w-32"
        />
      ),
    }) as ColumnDef<Section, unknown>,
  ];

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers />
          </EmptyMedia>
          <EmptyTitle>{t('noSections')}</EmptyTitle>
          <EmptyDescription>{t('noSectionsDescription')}</EmptyDescription>
        </EmptyHeader>
        <Can I="create" a="Section">
          <CreateSectionDialog standardId={standardId} standard={standard} />
        </Can>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Can I="create" a="Section">
          <CreateSectionDialog standardId={standardId} standard={standard} />
        </Can>
      </div>
      <DataTable columns={sectionColumns} data={sections} />
    </div>
  );
}

// ── Subjects Tab ──

function SubjectsTab({
  subjects,
  loading,
  standardId,
  t,
}: {
  subjects: Subject[];
  loading: boolean;
  standardId: string;
  t: ReturnType<typeof useTranslations<'academics'>>;
}) {
  const subjectColumnHelper = createColumnHelper<Subject>();

  const subjectColumns: ColumnDef<Subject, unknown>[] = [
    subjectColumnHelper.accessor('name', {
      header: t('name'),
      cell: ({ getValue }) => <span className="font-medium">{getValue()}</span>,
    }) as ColumnDef<Subject, unknown>,
    subjectColumnHelper.accessor('shortName', {
      header: t('shortName'),
    }) as ColumnDef<Subject, unknown>,
    subjectColumnHelper.accessor('boardCode', {
      header: t('boardCode'),
      cell: ({ getValue }) => {
        const code = getValue() as string | null;
        return code ? <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{code}</code> : '—';
      },
    }) as ColumnDef<Subject, unknown>,
    subjectColumnHelper.accessor('type', {
      header: t('type'),
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return (
          <Badge
            variant="secondary"
            className={`text-[10px] border-0 ${SUBJECT_TYPE_COLORS[type] ?? ''}`}
          >
            {t(`subjectTypes.${type}` as Parameters<typeof t>[0])}
          </Badge>
        );
      },
    }) as ColumnDef<Subject, unknown>,
    subjectColumnHelper.accessor('isMandatory', {
      header: t('isMandatory'),
      cell: ({ getValue }) => (getValue() ? <Check className="size-4 text-emerald-600" /> : null),
    }) as ColumnDef<Subject, unknown>,
    subjectColumnHelper.accessor('hasPractical', {
      header: t('hasPractical'),
      cell: ({ getValue }) => (getValue() ? <Check className="size-4 text-blue-600" /> : null),
    }) as ColumnDef<Subject, unknown>,
    subjectColumnHelper.display({
      id: 'marks',
      header: t('marks'),
      cell: ({ row }) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {row.original.theoryMarks ?? 0}/{row.original.practicalMarks ?? 0}/
          {row.original.internalMarks ?? 0}
        </span>
      ),
    }) as ColumnDef<Subject, unknown>,
    subjectColumnHelper.accessor('isElective', {
      header: t('isElective'),
      cell: ({ row }) =>
        row.original.isElective ? (
          <Badge variant="outline" className="text-[10px]">
            {row.original.electiveGroup ?? t('isElective')}
          </Badge>
        ) : null,
    }) as ColumnDef<Subject, unknown>,
  ];

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <BookOpen />
          </EmptyMedia>
          <EmptyTitle>{t('noSubjects')}</EmptyTitle>
          <EmptyDescription>{t('noSubjectsDescription')}</EmptyDescription>
        </EmptyHeader>
        <Can I="create" a="Subject">
          <CreateSubjectDialog standardId={standardId} />
        </Can>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Can I="create" a="Subject">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => toast.info(t('importFromCatalog'))}
          >
            <Download className="size-4" />
            {t('importFromCatalog')}
          </Button>
          <CreateSubjectDialog standardId={standardId} />
        </Can>
      </div>
      <DataTable columns={subjectColumns} data={subjects} />
    </div>
  );
}

// ── Error Handling Helpers ──

type ErrorMapping = {
  pattern: string;
  field?: string;
  messageKey: string;
  level?: 'error' | 'warning';
};

function handleFormError<TField extends string>(
  err: unknown,
  mappings: ErrorMapping[],
  t: (key: string) => string,
  setError: (field: TField, opts: { message: string }) => void,
) {
  const msg = err instanceof Error ? err.message : String(err);
  for (const mapping of mappings) {
    if (!msg.includes(mapping.pattern)) continue;
    if (mapping.field) {
      setError(mapping.field as TField, {
        message: t(mapping.messageKey),
      });
    } else if (mapping.level === 'warning') {
      toast.warning(t(mapping.messageKey));
    } else {
      toast.error(t(mapping.messageKey));
    }
    return;
  }
  toast.error(msg);
}

const SECTION_ERROR_MAPPINGS: ErrorMapping[] = [
  { pattern: 'SECTION_NAME_DUPLICATE', field: 'name', messageKey: 'errors.SECTION_NAME_DUPLICATE' },
  { pattern: 'STREAM_REQUIRED', field: 'streamName', messageKey: 'errors.STREAM_REQUIRED' },
  { pattern: 'CONCURRENT_MODIFICATION', messageKey: 'errors.CONCURRENT_MODIFICATION' },
  { pattern: '409', messageKey: 'errors.CONCURRENT_MODIFICATION' },
  {
    pattern: 'CAPACITY_EXCEEDED',
    messageKey: 'errors.SECTION_CAPACITY_EXCEEDED',
    level: 'warning',
  },
];

const SUBJECT_ERROR_MAPPINGS: ErrorMapping[] = [
  {
    pattern: 'SUBJECT_CODE_DUPLICATE',
    field: 'boardCode',
    messageKey: 'errors.SUBJECT_CODE_DUPLICATE',
  },
  { pattern: 'CONCURRENT_MODIFICATION', messageKey: 'errors.CONCURRENT_MODIFICATION' },
  { pattern: '409', messageKey: 'errors.CONCURRENT_MODIFICATION' },
  { pattern: 'HAS_ACTIVE_ENROLLMENTS', messageKey: 'errors.HAS_ACTIVE_ENROLLMENTS' },
  { pattern: 'HAS_RECORDED_ASSESSMENTS', messageKey: 'errors.HAS_RECORDED_ASSESSMENTS' },
];

function buildStreamInput(
  standard: Standard | null,
  streamName: unknown,
  streamCode: unknown,
): { name: string; code: string } | undefined {
  if (!standard?.streamApplicable || !streamName) return undefined;
  return {
    name: streamName as string,
    code: (streamCode as string) || (streamName as string).toLowerCase().replace(/\s+/g, '_'),
  };
}

// ── Create Section Dialog ──

function CreateSectionDialog({
  standardId,
  standard,
}: {
  standardId: string;
  standard: Standard | null;
}) {
  const t = useTranslations('academics');
  const { createSection, loading } = useCreateSection();
  const [open, setOpen] = useState(false);
  const [yearId] = useQueryState('year', parseAsString);

  const form = useForm({
    defaultValues: {
      name: '',
      displayLabel: '',
      streamName: '',
      streamCode: '',
      mediumOfInstruction: '',
      shift: '',
      capacity: standard?.maxStudentsPerSection ?? 40,
      genderRestriction: 'CO_ED',
      batchStartTime: '',
      batchEndTime: '',
      batchStatus: 'UPCOMING',
    },
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      await createSection({
        standardId,
        academicYearId: yearId,
        name: data.name,
        displayLabel: data.displayLabel || undefined,
        stream: buildStreamInput(standard, data.streamName, data.streamCode),
        mediumOfInstruction: data.mediumOfInstruction || undefined,
        shift: data.shift || undefined,
        capacity: Number(data.capacity) || 40,
        genderRestriction: data.genderRestriction,
        startTime: data.batchStartTime || undefined,
        endTime: data.batchEndTime || undefined,
        batchStatus: data.batchStatus || undefined,
      });
      toast.success(t('created'));
      setOpen(false);
      form.reset();
    } catch (err) {
      handleFormError(err, SECTION_ERROR_MAPPINGS, t, form.setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="size-4" />
          {t('createSection')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createSection')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel>{t('name')}</FieldLabel>
              <Input placeholder="e.g. A" {...form.register('name', { required: true })} />
              {form.formState.errors.name && (
                <FieldError>
                  {(form.formState.errors.name as { message?: string }).message}
                </FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel>{t('displayLabel')}</FieldLabel>
              <Input placeholder="e.g. Class 10-A" {...form.register('displayLabel')} />
            </Field>
            {standard?.streamApplicable && (
              <Field>
                <FieldLabel>{t('stream')}</FieldLabel>
                <Select
                  value={form.watch('streamName')}
                  onValueChange={(v) => {
                    form.setValue('streamName', v);
                    form.setValue('streamCode', v.toLowerCase().replace(/\s+/g, '_'));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('stream')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries({
                      'Science PCM': 'sci_pcm',
                      'Science PCB': 'sci_pcb',
                      Commerce: 'commerce',
                      Arts: 'arts',
                    }).map(([name, code]) => (
                      <SelectItem key={code} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.streamName && (
                  <FieldError>
                    {(form.formState.errors.streamName as { message?: string }).message}
                  </FieldError>
                )}
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('medium')}</FieldLabel>
                <Select
                  value={form.watch('mediumOfInstruction')}
                  onValueChange={(v) => form.setValue('mediumOfInstruction', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['english', 'hindi', 'bilingual', 'urdu'].map((m) => (
                      <SelectItem key={m} value={m}>
                        {t(`mediumOptions.${m}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>{t('capacity')}</FieldLabel>
                <Input type="number" {...form.register('capacity', { valueAsNumber: true })} />
              </Field>
            </div>
            <Field>
              <FieldLabel>{t('genderRestriction')}</FieldLabel>
              <Select
                value={form.watch('genderRestriction')}
                onValueChange={(v) => form.setValue('genderRestriction', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['CO_ED', 'BOYS_ONLY', 'GIRLS_ONLY'].map((g) => (
                    <SelectItem key={g} value={g}>
                      {t(`genderOptions.${g}` as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {/* Shift field */}
            <Field>
              <FieldLabel>{t('shift')}</FieldLabel>
              <Input placeholder="e.g. Morning" {...form.register('shift')} />
            </Field>
            {/* Coaching batch fields — shown only for coaching type */}
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel>{t('batchStartTime')}</FieldLabel>
                <Input type="time" {...form.register('batchStartTime')} />
              </Field>
              <Field>
                <FieldLabel>{t('batchEndTime')}</FieldLabel>
                <Input type="time" {...form.register('batchEndTime')} />
              </Field>
              <Field>
                <FieldLabel>{t('batchStatus')}</FieldLabel>
                <Select
                  value={form.watch('batchStatus')}
                  onValueChange={(v) => form.setValue('batchStatus', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPCOMING">Upcoming</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('creating') : t('createSection')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Subject Dialog ──

function CreateSubjectDialog({ standardId: _standardId }: { standardId: string }) {
  const t = useTranslations('academics');
  const { createSubject, loading } = useCreateSubject();
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      name: '',
      shortName: '',
      boardCode: '',
      type: 'ACADEMIC',
      isMandatory: false,
      hasPractical: false,
      isElective: false,
      theoryMarks: 80,
      practicalMarks: 0,
      internalMarks: 20,
      electiveGroup: '',
    },
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      await createSubject({
        name: data.name,
        shortName: data.shortName || undefined,
        boardCode: data.boardCode || undefined,
        type: data.type,
        isMandatory: data.isMandatory,
        hasPractical: data.hasPractical,
        isElective: data.isElective,
        theoryMarks: Number(data.theoryMarks) || 0,
        practicalMarks: Number(data.practicalMarks) || 0,
        internalMarks: Number(data.internalMarks) || 0,
        electiveGroup: data.isElective ? (data.electiveGroup as string) || undefined : undefined,
      });
      toast.success(t('created'));
      setOpen(false);
      form.reset();
    } catch (err) {
      handleFormError(err, SUBJECT_ERROR_MAPPINGS, t, form.setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="size-4" />
          {t('createSubject')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createSubject')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('name')}</FieldLabel>
                <Input placeholder="e.g. Physics" {...form.register('name', { required: true })} />
              </Field>
              <Field>
                <FieldLabel>{t('shortName')}</FieldLabel>
                <Input placeholder="e.g. Phy" {...form.register('shortName')} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>{t('boardCode')}</FieldLabel>
                <Input placeholder="e.g. 042" {...form.register('boardCode')} />
                {form.formState.errors.boardCode && (
                  <FieldError>
                    {(form.formState.errors.boardCode as { message?: string }).message}
                  </FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel>{t('type')}</FieldLabel>
                <Select value={form.watch('type')} onValueChange={(v) => form.setValue('type', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      'ACADEMIC',
                      'LANGUAGE',
                      'SKILL',
                      'EXTRACURRICULAR',
                      'INTERNAL_ASSESSMENT',
                    ].map((st) => (
                      <SelectItem key={st} value={st}>
                        {t(`subjectTypes.${st}` as Parameters<typeof t>[0])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.watch('isMandatory') as boolean}
                  onCheckedChange={(v) => form.setValue('isMandatory', v)}
                />
                {t('isMandatory')}
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.watch('hasPractical') as boolean}
                  onCheckedChange={(v) => form.setValue('hasPractical', v)}
                />
                {t('hasPractical')}
              </span>
              <span className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.watch('isElective') as boolean}
                  onCheckedChange={(v) => form.setValue('isElective', v)}
                />
                {t('isElective')}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel>{t('theoryMarks')}</FieldLabel>
                <Input type="number" {...form.register('theoryMarks', { valueAsNumber: true })} />
              </Field>
              <Field>
                <FieldLabel>{t('practicalMarks')}</FieldLabel>
                <Input
                  type="number"
                  {...form.register('practicalMarks', { valueAsNumber: true })}
                />
              </Field>
              <Field>
                <FieldLabel>{t('internalMarks')}</FieldLabel>
                <Input type="number" {...form.register('internalMarks', { valueAsNumber: true })} />
              </Field>
            </div>
            {form.watch('isElective') && (
              <Field>
                <FieldLabel>{t('electiveGroup')}</FieldLabel>
                <Input placeholder="e.g. math_level" {...form.register('electiveGroup')} />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('creating') : t('createSubject')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
