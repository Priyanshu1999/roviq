'use client';

import { extractGraphQLError } from '@roviq/graphql';
import type { StreamObject } from '@roviq/graphql/generated';
import { buildI18nTextSchema, useI18nField } from '@roviq/i18n';
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
  FieldGroup,
  I18nField,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useAppForm,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { ArrowLeft, BookOpen, Check, Download, Layers, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
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

const GENDER_VALUES = ['CO_ED', 'BOYS_ONLY', 'GIRLS_ONLY'] as const;
const MEDIUM_VALUES = ['english', 'hindi', 'bilingual', 'urdu'] as const;
const BATCH_STATUS_VALUES = ['UPCOMING', 'ACTIVE', 'COMPLETED'] as const;
const SUBJECT_TYPE_VALUES = [
  'ACADEMIC',
  'LANGUAGE',
  'SKILL',
  'EXTRACURRICULAR',
  'INTERNAL_ASSESSMENT',
] as const;

type GenderValue = (typeof GENDER_VALUES)[number];
type MediumValue = (typeof MEDIUM_VALUES)[number];
type BatchStatusValue = (typeof BATCH_STATUS_VALUES)[number];
type SubjectTypeValue = (typeof SUBJECT_TYPE_VALUES)[number];

const STREAM_OPTIONS: ReadonlyArray<{ name: string; code: string }> = [
  { name: 'Science PCM', code: 'sci_pcm' },
  { name: 'Science PCB', code: 'sci_pcb' },
  { name: 'Commerce', code: 'commerce' },
  { name: 'Arts', code: 'arts' },
];

function emptyToUndefined<T extends string>(value: T | ''): T | undefined {
  return value === '' ? undefined : value;
}

export default function StandardDetailPage() {
  const t = useTranslations('academics');
  const params = useParams();
  const locale = params.locale as string;
  const standardId = params.standardId as string;
  const [yearId] = useQueryState('year', parseAsString);

  const resolveI18n = useI18nField();
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
                data-testid="academics-standard-back-link"
              >
                <ArrowLeft className="size-4" />
                {t('back')}
              </Link>
              <div className="flex-1">
                <h1
                  className="text-2xl font-semibold tracking-tight"
                  data-testid="academics-standard-detail-title"
                >
                  {resolveI18n(standard?.name) ?? '...'}
                </h1>
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
                <TabsTrigger
                  value="sections"
                  className="gap-1.5"
                  data-testid="academics-standard-sections-tab"
                >
                  <Users className="size-3.5" />
                  {t('sections')} ({sections.length})
                </TabsTrigger>
                <TabsTrigger
                  value="subjects"
                  className="gap-1.5"
                  data-testid="academics-standard-subjects-tab"
                >
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
  const resolveI18n = useI18nField();
  const sectionColumnHelper = createColumnHelper<Section>();

  const sectionColumns: ColumnDef<Section, unknown>[] = [
    sectionColumnHelper.accessor('name', {
      header: t('name'),
      cell: ({ getValue }) => <span className="font-medium">{resolveI18n(getValue())}</span>,
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
      <DataTable columns={sectionColumns} data={sections} data-testid="academics-sections-table" />
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
            data-testid="academics-subject-import-btn"
          >
            <Download className="size-4" />
            {t('importFromCatalog')}
          </Button>
          <CreateSubjectDialog standardId={standardId} />
        </Can>
      </div>
      <DataTable columns={subjectColumns} data={subjects} data-testid="academics-subjects-table" />
    </div>
  );
}

// ── Error Handling Helpers ──

type SectionMessageKey =
  | 'errors.SECTION_NAME_DUPLICATE'
  | 'errors.STREAM_REQUIRED'
  | 'errors.CONCURRENT_MODIFICATION'
  | 'errors.SECTION_CAPACITY_EXCEEDED';

type SubjectMessageKey =
  | 'errors.SUBJECT_CODE_DUPLICATE'
  | 'errors.CONCURRENT_MODIFICATION'
  | 'errors.HAS_ACTIVE_ENROLLMENTS'
  | 'errors.HAS_RECORDED_ASSESSMENTS';

interface SectionErrorMapping {
  pattern: string;
  field?: 'name.en' | 'streamName';
  messageKey: SectionMessageKey;
  level?: 'error' | 'warning';
}

interface SubjectErrorMapping {
  pattern: string;
  field?: 'boardCode';
  messageKey: SubjectMessageKey;
  level?: 'error' | 'warning';
}

function dispatchSectionError(
  err: unknown,
  t: ReturnType<typeof useTranslations<'academics'>>,
  fieldErrorSetters: Record<'name.en' | 'streamName', (message: string) => void>,
) {
  const msg = extractGraphQLError(err, t('errors.SECTION_NAME_DUPLICATE'));
  for (const mapping of SECTION_ERROR_MAPPINGS) {
    if (!msg.includes(mapping.pattern)) continue;
    if (mapping.field) {
      fieldErrorSetters[mapping.field](t(mapping.messageKey));
    } else if (mapping.level === 'warning') {
      toast.warning(t(mapping.messageKey));
    } else {
      toast.error(t(mapping.messageKey));
    }
    return;
  }
  toast.error(msg);
}

function dispatchSubjectError(
  err: unknown,
  t: ReturnType<typeof useTranslations<'academics'>>,
  fieldErrorSetters: Record<'boardCode', (message: string) => void>,
) {
  const msg = extractGraphQLError(err, t('errors.SUBJECT_CODE_DUPLICATE'));
  for (const mapping of SUBJECT_ERROR_MAPPINGS) {
    if (!msg.includes(mapping.pattern)) continue;
    if (mapping.field) {
      fieldErrorSetters[mapping.field](t(mapping.messageKey));
    } else if (mapping.level === 'warning') {
      toast.warning(t(mapping.messageKey));
    } else {
      toast.error(t(mapping.messageKey));
    }
    return;
  }
  toast.error(msg);
}

const SECTION_ERROR_MAPPINGS: SectionErrorMapping[] = [
  {
    pattern: 'SECTION_NAME_DUPLICATE',
    field: 'name.en',
    messageKey: 'errors.SECTION_NAME_DUPLICATE',
  },
  { pattern: 'STREAM_REQUIRED', field: 'streamName', messageKey: 'errors.STREAM_REQUIRED' },
  { pattern: 'CONCURRENT_MODIFICATION', messageKey: 'errors.CONCURRENT_MODIFICATION' },
  { pattern: '409', messageKey: 'errors.CONCURRENT_MODIFICATION' },
  {
    pattern: 'CAPACITY_EXCEEDED',
    messageKey: 'errors.SECTION_CAPACITY_EXCEEDED',
    level: 'warning',
  },
];

const SUBJECT_ERROR_MAPPINGS: SubjectErrorMapping[] = [
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
  streamName: string | undefined,
  streamCode: string | undefined,
): { name: string; code: string } | undefined {
  if (!standard?.streamApplicable || !streamName) return undefined;
  return {
    name: streamName,
    code: streamCode || streamName.toLowerCase().replace(/\s+/g, '_'),
  };
}

// ── Create Section Dialog ──

type SectionFormValues = {
  name: Record<string, string>;
  displayLabel: string;
  streamName: string;
  streamCode: string;
  mediumOfInstruction: MediumValue | '';
  shift: string;
  capacity: number;
  genderRestriction: GenderValue;
  batchStartTime: string;
  batchEndTime: string;
  batchStatus: BatchStatusValue;
};

function buildSectionSchema(t: ReturnType<typeof useTranslations<'academics'>>) {
  return z.object({
    name: buildI18nTextSchema(t('errors.SECTION_NAME_DUPLICATE')),
    displayLabel: z.string(),
    streamName: z.string(),
    streamCode: z.string(),
    mediumOfInstruction: z.union([z.enum(MEDIUM_VALUES), z.literal('')]),
    shift: z.string(),
    capacity: z.number().int().min(0),
    genderRestriction: z.enum(GENDER_VALUES),
    batchStartTime: z.string(),
    batchEndTime: z.string(),
    batchStatus: z.enum(BATCH_STATUS_VALUES),
  });
}

function CreateSectionDialog({
  standardId,
  standard,
}: {
  standardId: string;
  standard: Standard | null;
}) {
  const t = useTranslations('academics');
  const { createSection, loading } = useCreateSection();
  const [open, setOpen] = React.useState(false);
  const [yearId] = useQueryState('year', parseAsString);

  const schema = React.useMemo(() => buildSectionSchema(t), [t]);

  const defaults = React.useMemo<SectionFormValues>(
    () => ({
      name: { en: '', hi: '' },
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
    }),
    [standard?.maxStudentsPerSection],
  );

  const mediumOptions = MEDIUM_VALUES.map((m) => ({
    value: m,
    label: t(`mediumOptions.${m}` as Parameters<typeof t>[0]),
  }));
  const genderOptions = GENDER_VALUES.map((g) => ({
    value: g,
    label: t(`genderOptions.${g}` as Parameters<typeof t>[0]),
  }));
  const streamOptions = STREAM_OPTIONS.map((s) => ({ value: s.name, label: s.name }));
  const batchStatusOptions = BATCH_STATUS_VALUES.map((b) => ({ value: b, label: b }));

  const form = useAppForm({
    defaultValues: defaults,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        await createSection({
          standardId,
          academicYearId: yearId,
          name: parsed.name,
          displayLabel: parsed.displayLabel || undefined,
          stream: buildStreamInput(
            standard,
            parsed.streamName || undefined,
            parsed.streamCode || undefined,
          ),
          mediumOfInstruction: emptyToUndefined(parsed.mediumOfInstruction),
          shift: parsed.shift || undefined,
          capacity: parsed.capacity || 40,
          genderRestriction: parsed.genderRestriction,
          startTime: parsed.batchStartTime || undefined,
          endTime: parsed.batchEndTime || undefined,
          batchStatus: parsed.batchStatus,
        });
        toast.success(t('created'));
        setOpen(false);
        form.reset();
      } catch (err) {
        dispatchSectionError(err, t, {
          'name.en': (message) =>
            form.setFieldMeta('name.en', (prev) => ({
              ...prev,
              isTouched: true,
              errorMap: { ...prev.errorMap, onSubmit: message },
            })),
          streamName: (message) =>
            form.setFieldMeta('streamName', (prev) => ({
              ...prev,
              isTouched: true,
              errorMap: { ...prev.errorMap, onSubmit: message },
            })),
        });
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" data-testid="academics-section-new-btn">
          <Plus className="size-4" />
          {t('createSection')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createSection')}</DialogTitle>
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
              placeholder="e.g. A"
              testId="academics-section-name-input"
            />
            <form.AppField name="displayLabel">
              {(field) => (
                <field.TextField
                  label={t('displayLabel')}
                  placeholder="e.g. Class 10-A"
                  testId="academics-section-display-label-input"
                />
              )}
            </form.AppField>
            {standard?.streamApplicable && (
              <form.AppField name="streamName">
                {(field) => (
                  <field.SelectField
                    label={t('stream')}
                    options={streamOptions}
                    placeholder={t('stream')}
                    testId="academics-section-stream-select"
                    onValueChange={(value) => {
                      const code = value ? value.toLowerCase().replace(/\s+/g, '_') : '';
                      form.setFieldValue('streamCode', code);
                    }}
                  />
                )}
              </form.AppField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="mediumOfInstruction">
                {(field) => (
                  <field.SelectField
                    label={t('medium')}
                    options={mediumOptions}
                    testId="academics-section-medium-select"
                  />
                )}
              </form.AppField>
              <form.AppField name="capacity">
                {(field) => (
                  <field.NumberField
                    label={t('capacity')}
                    testId="academics-section-capacity-input"
                    min={0}
                  />
                )}
              </form.AppField>
            </div>
            <form.AppField name="genderRestriction">
              {(field) => (
                <field.SelectField
                  label={t('genderRestriction')}
                  options={genderOptions}
                  optional={false}
                  testId="academics-section-gender-select"
                />
              )}
            </form.AppField>
            {/* Shift field */}
            <form.AppField name="shift">
              {(field) => (
                <field.TextField
                  label={t('shift')}
                  placeholder="e.g. Morning"
                  testId="academics-section-shift-input"
                />
              )}
            </form.AppField>
            {/* Coaching batch fields — shown only for coaching type */}
            <div className="grid grid-cols-3 gap-3">
              <form.AppField name="batchStartTime">
                {(field) => (
                  <field.TextField
                    label={t('batchStartTime')}
                    type="text"
                    inputMode="text"
                    testId="academics-section-batch-start-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="batchEndTime">
                {(field) => (
                  <field.TextField
                    label={t('batchEndTime')}
                    type="text"
                    inputMode="text"
                    testId="academics-section-batch-end-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="batchStatus">
                {(field) => (
                  <field.SelectField
                    label={t('batchStatus')}
                    options={batchStatusOptions}
                    optional={false}
                    testId="academics-section-batch-status-select"
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
              data-testid="academics-section-create-cancel-btn"
            >
              {t('cancel')}
            </Button>
            <form.AppForm>
              <form.SubmitButton
                disabled={loading}
                submittingLabel={t('creating')}
                testId="academics-section-create-submit-btn"
              >
                {t('createSection')}
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Create Subject Dialog ──

type SubjectFormValues = {
  name: string;
  shortName: string;
  boardCode: string;
  type: SubjectTypeValue;
  isMandatory: boolean;
  hasPractical: boolean;
  isElective: boolean;
  theoryMarks: number;
  practicalMarks: number;
  internalMarks: number;
  electiveGroup: string;
};

function buildSubjectSchema(_t: ReturnType<typeof useTranslations<'academics'>>) {
  return z.object({
    name: z.string().min(1),
    shortName: z.string(),
    boardCode: z.string(),
    type: z.enum(SUBJECT_TYPE_VALUES),
    isMandatory: z.boolean(),
    hasPractical: z.boolean(),
    isElective: z.boolean(),
    theoryMarks: z.number().int().min(0),
    practicalMarks: z.number().int().min(0),
    internalMarks: z.number().int().min(0),
    electiveGroup: z.string(),
  });
}

const EMPTY_SUBJECT_DEFAULTS: SubjectFormValues = {
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
};

function CreateSubjectDialog({ standardId: _standardId }: { standardId: string }) {
  const t = useTranslations('academics');
  const { createSubject, loading } = useCreateSubject();
  const [open, setOpen] = React.useState(false);

  const schema = React.useMemo(() => buildSubjectSchema(t), [t]);

  const subjectTypeOptions = SUBJECT_TYPE_VALUES.map((st) => ({
    value: st,
    label: t(`subjectTypes.${st}` as Parameters<typeof t>[0]),
  }));

  const form = useAppForm({
    defaultValues: EMPTY_SUBJECT_DEFAULTS,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        await createSubject({
          name: parsed.name,
          shortName: parsed.shortName || undefined,
          boardCode: parsed.boardCode || undefined,
          type: parsed.type,
          isMandatory: parsed.isMandatory,
          hasPractical: parsed.hasPractical,
          isElective: parsed.isElective,
          theoryMarks: parsed.theoryMarks,
          practicalMarks: parsed.practicalMarks,
          internalMarks: parsed.internalMarks,
          electiveGroup: parsed.isElective ? parsed.electiveGroup || undefined : undefined,
        });
        toast.success(t('created'));
        setOpen(false);
        form.reset();
      } catch (err) {
        dispatchSubjectError(err, t, {
          boardCode: (message) =>
            form.setFieldMeta('boardCode', (prev) => ({
              ...prev,
              isTouched: true,
              errorMap: { ...prev.errorMap, onSubmit: message },
            })),
        });
      }
    },
  });

  const isElective = useStore(form.store, (state) => state.values.isElective);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" data-testid="academics-subject-new-btn">
          <Plus className="size-4" />
          {t('createSubject')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('createSubject')}</DialogTitle>
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
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="name">
                {(field) => (
                  <field.TextField
                    label={t('name')}
                    placeholder="e.g. Physics"
                    testId="academics-subject-name-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="shortName">
                {(field) => (
                  <field.TextField
                    label={t('shortName')}
                    placeholder="e.g. Phy"
                    testId="academics-subject-short-name-input"
                  />
                )}
              </form.AppField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="boardCode">
                {(field) => (
                  <field.TextField
                    label={t('boardCode')}
                    placeholder="e.g. 042"
                    testId="academics-subject-board-code-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="type">
                {(field) => (
                  <field.SelectField
                    label={t('type')}
                    options={subjectTypeOptions}
                    optional={false}
                    testId="academics-subject-type-select"
                  />
                )}
              </form.AppField>
            </div>
            <div className="flex items-center gap-6">
              <form.AppField name="isMandatory">
                {(field) => (
                  <field.SwitchField
                    label={t('isMandatory')}
                    testId="academics-subject-is-mandatory-switch"
                  />
                )}
              </form.AppField>
              <form.AppField name="hasPractical">
                {(field) => (
                  <field.SwitchField
                    label={t('hasPractical')}
                    testId="academics-subject-has-practical-switch"
                  />
                )}
              </form.AppField>
              <form.AppField name="isElective">
                {(field) => (
                  <field.SwitchField
                    label={t('isElective')}
                    testId="academics-subject-is-elective-switch"
                  />
                )}
              </form.AppField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <form.AppField name="theoryMarks">
                {(field) => (
                  <field.NumberField
                    label={t('theoryMarks')}
                    testId="academics-subject-theory-marks-input"
                    min={0}
                  />
                )}
              </form.AppField>
              <form.AppField name="practicalMarks">
                {(field) => (
                  <field.NumberField
                    label={t('practicalMarks')}
                    testId="academics-subject-practical-marks-input"
                    min={0}
                  />
                )}
              </form.AppField>
              <form.AppField name="internalMarks">
                {(field) => (
                  <field.NumberField
                    label={t('internalMarks')}
                    testId="academics-subject-internal-marks-input"
                    min={0}
                  />
                )}
              </form.AppField>
            </div>
            {isElective && (
              <form.AppField name="electiveGroup">
                {(field) => (
                  <field.TextField
                    label={t('electiveGroup')}
                    placeholder="e.g. math_level"
                    testId="academics-subject-elective-group-input"
                  />
                )}
              </form.AppField>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="academics-subject-create-cancel-btn"
            >
              {t('cancel')}
            </Button>
            <form.AppForm>
              <form.SubmitButton
                disabled={loading}
                submittingLabel={t('creating')}
                testId="academics-subject-create-submit-btn"
              >
                {t('createSubject')}
              </form.SubmitButton>
            </form.AppForm>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
