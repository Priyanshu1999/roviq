'use client';

import { useI18nField } from '@roviq/i18n';
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useAppForm,
  useDebounce,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import type { ColumnDef } from '@tanstack/react-table';
import { Award, CheckCircle2, Clock, Plus, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  type CertificateNode,
  useCertificates,
  useCertificateTemplateFields,
  useIssueCertificate,
  usePreviewCertificate,
  useRequestCertificate,
  useStudentPicker,
} from '../use-certificates';

/**
 * Certificate types the institute can issue. Matches the backend
 * `ListCertificateFilterInput.type` values. Each type has its own
 * tab + template selector.
 */
const CERTIFICATE_TYPES = [
  'BONAFIDE_CERTIFICATE',
  'CHARACTER_CERTIFICATE',
  'SCHOOL_LEAVING_CERTIFICATE',
  'RAILWAY_CONCESSION',
  'CUSTOM',
] as const;
type CertificateType = (typeof CERTIFICATE_TYPES)[number];

const STATUS_CLASS: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ISSUED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  REQUESTED: Clock,
  ISSUED: CheckCircle2,
  REJECTED: XCircle,
  CANCELLED: XCircle,
};

function formatDdMmYyyy(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function OtherCertificatesPage() {
  const t = useTranslations('certificates');
  const [activeTab, setActiveTab] = React.useState<CertificateType>('BONAFIDE_CERTIFICATE');
  const [issueOpen, setIssueOpen] = React.useState(false);

  return (
    <Can I="read" a="Certificate" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="other-certs-title">
                  {t('other.title')}
                </h1>
                <p className="text-muted-foreground">{t('other.description')}</p>
              </div>
              <Can I="create" a="Certificate">
                <Button onClick={() => setIssueOpen(true)}>
                  <Plus className="size-4" />
                  {t('other.issueButton', {
                    type: t(`types.${activeTab}`, { default: activeTab }),
                  })}
                </Button>
              </Can>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CertificateType)}>
              <TabsList>
                {CERTIFICATE_TYPES.map((type) => (
                  <TabsTrigger key={type} value={type}>
                    {t(`types.${type}`, { default: type })}
                  </TabsTrigger>
                ))}
              </TabsList>

              {CERTIFICATE_TYPES.map((type) => (
                <TabsContent key={type} value={type} className="mt-4">
                  <CertificateTypeTable type={type} />
                </TabsContent>
              ))}
            </Tabs>

            <IssueCertificateDialog
              open={issueOpen}
              onOpenChange={setIssueOpen}
              defaultType={activeTab}
            />
          </div>
        ) : null
      }
    </Can>
  );
}

function CertificateTypeTable({ type }: { type: CertificateType }) {
  const t = useTranslations('certificates');
  const router = useRouter();
  const [issueCertificate] = useIssueCertificate();
  const { certificates, loading } = useCertificates({ type });

  const handleIssue = React.useCallback(
    async (id: string) => {
      try {
        await issueCertificate({ variables: { id } });
        toast.success(t('other.issueSuccess'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('other.issueError'));
      }
    },
    [issueCertificate, t],
  );

  const columns = React.useMemo<ColumnDef<CertificateNode>[]>(
    () => [
      {
        accessorKey: 'serialNumber',
        header: t('columns.serialNumber'),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.original.serialNumber}</span>
        ),
      },
      {
        id: 'student',
        header: t('columns.student'),
        cell: ({ row }) =>
          row.original.studentProfileId ? (
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/institute/people/students/${row.original.studentProfileId}`);
              }}
            >
              {row.original.studentProfileId.slice(0, 8)}…
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'purpose',
        header: t('columns.purpose'),
        cell: ({ row }) => (
          <span className="block max-w-xs truncate text-sm text-muted-foreground">
            {row.original.purpose ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('columns.status'),
        cell: ({ row }) => {
          const status = row.original.status.toUpperCase();
          const Icon = STATUS_ICON[status] ?? Clock;
          return (
            <Badge
              variant="secondary"
              className={`inline-flex items-center gap-1 ${STATUS_CLASS[status] ?? ''}`}
            >
              <Icon className="size-3.5" />
              {t(`certificateStatuses.${status}`, { default: status })}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'createdAt',
        header: t('columns.issuedDate'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDdMmYyyy(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          row.original.status.toUpperCase() === 'REQUESTED' ? (
            <Can I="manage" a="Certificate">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleIssue(row.original.id);
                }}
              >
                {t('other.issue')}
              </Button>
            </Can>
          ) : null,
      },
    ],
    [t, router, handleIssue],
  );

  return (
    <DataTable
      columns={columns}
      data={certificates}
      isLoading={loading && certificates.length === 0}
      stickyFirstColumn
      skeletonRows={6}
      emptyState={
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Award />
            </EmptyMedia>
            <EmptyTitle>{t('other.empty.noData')}</EmptyTitle>
            <EmptyDescription>{t('other.empty.noDataDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
    />
  );
}

// ─── Issue Certificate Dialog ───────────────────────────────────────────────

const issueCertSchema = z.object({
  templateId: z.string().min(1, 'Template is required'),
  studentProfileId: z.string().min(1, 'Student is required'),
  purpose: z.string().min(3, 'Purpose is required'),
});
type IssueCertFormValues = z.input<typeof issueCertSchema>;

const ISSUE_CERT_DEFAULTS: IssueCertFormValues = {
  templateId: '',
  studentProfileId: '',
  purpose: '',
};

function IssueCertificateDialog({
  open,
  onOpenChange,
  defaultType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType: CertificateType;
}) {
  const t = useTranslations('certificates');
  const resolveI18n = useI18nField();
  const [studentSearch, setStudentSearch] = React.useState('');
  const debouncedSearch = useDebounce(studentSearch, 250);
  const { data: studentsData } = useStudentPicker(debouncedSearch);
  const [requestCertificate] = useRequestCertificate();
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [runPreview, { loading: previewLoading }] = usePreviewCertificate();

  const form = useAppForm({
    defaultValues: ISSUE_CERT_DEFAULTS,
    validators: { onChange: issueCertSchema, onSubmit: issueCertSchema },
    onSubmit: async ({ value }) => {
      const parsed = issueCertSchema.parse(value);
      try {
        await requestCertificate({ variables: { input: parsed } });
        toast.success(t('other.requestSuccess'));
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('other.requestError'));
      }
    },
  });

  // Cascading-dropdown dependencies — render-prop trees can't read sibling
  // state without `useStore`.
  const templateId = useStore(
    form.store,
    (state) => (state.values as IssueCertFormValues).templateId,
  );
  const studentProfileId = useStore(
    form.store,
    (state) => (state.values as IssueCertFormValues).studentProfileId,
  );
  const purpose = useStore(form.store, (state) => (state.values as IssueCertFormValues).purpose);

  const { data: fieldsData } = useCertificateTemplateFields(templateId || null);
  const templateFields = fieldsData?.getCertificateTemplateFields ?? [];

  React.useEffect(() => {
    if (!open) {
      form.reset(ISSUE_CERT_DEFAULTS);
      setStudentSearch('');
      setPreviewHtml(null);
      setPreviewOpen(false);
    }
  }, [open, form]);

  const students = studentsData?.listStudents.edges.map((e) => e.node) ?? [];
  const selectedStudent = students.find((s) => s.id === studentProfileId) ?? null;

  /**
   * Resolves a placeholder field name against the selected student and
   * form purpose. Matches the backend `previewCertificate` substitution
   * so the auto-populate preview lines up with the eventual rendered PDF.
   */
  const resolveFieldValue = React.useCallback(
    (field: string): string => {
      if (!selectedStudent) return '';
      const fn = resolveI18n(selectedStudent.firstName) ?? '';
      const ln = resolveI18n(selectedStudent.lastName) ?? '';
      switch (field) {
        case 'studentName':
          return `${fn} ${ln}`.trim();
        case 'firstName':
          return fn;
        case 'lastName':
          return ln;
        case 'admissionNumber':
          return selectedStudent.admissionNumber;
        case 'class':
          return resolveI18n(selectedStudent.currentStandardName) ?? '';
        case 'section':
          return resolveI18n(selectedStudent.currentSectionName) ?? '';
        case 'dateOfIssue':
          return new Date().toISOString().split('T')[0] ?? '';
        case 'purpose':
          return purpose ?? '';
        default:
          return '';
      }
    },
    [selectedStudent, resolveI18n, purpose],
  );

  const handlePreview = async () => {
    if (!templateId || !studentProfileId) {
      toast.error(t('other.dialog.previewMissing'));
      return;
    }
    try {
      const result = await runPreview({
        variables: { input: { templateId, studentProfileId, purpose: purpose || undefined } },
      });
      const html = result.data?.previewCertificate ?? '';
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('other.dialog.previewError'));
    }
  };

  const studentOptions = React.useMemo(() => {
    const opts: Array<{ value: string; label: string; disabled?: boolean }> = [];
    if (students.length === 0) {
      opts.push({ value: '__none__', label: t('other.dialog.noStudents'), disabled: true });
      return opts;
    }
    for (const s of students) {
      const name = [resolveI18n(s.firstName), resolveI18n(s.lastName)].filter(Boolean).join(' ');
      opts.push({ value: s.id, label: `${s.admissionNumber} · ${name}` });
    }
    return opts;
  }, [students, resolveI18n, t]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('other.dialog.title', {
                type: t(`types.${defaultType}`, { default: defaultType }),
              })}
            </DialogTitle>
            <DialogDescription>{t('other.dialog.description')}</DialogDescription>
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
              <form.AppField name="templateId">
                {(field) => (
                  <field.TextField
                    label={t('other.dialog.templateLabel')}
                    placeholder={t('other.dialog.templatePlaceholder')}
                  />
                )}
              </form.AppField>
              <Field>
                <FieldLabel htmlFor="cert-student-search">
                  {t('other.dialog.studentLabel')}
                </FieldLabel>
                <Input
                  id="cert-student-search"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder={t('other.dialog.studentSearchPlaceholder')}
                />
              </Field>
              <form.AppField name="studentProfileId">
                {(field) => (
                  <field.SelectField
                    label={t('other.dialog.studentLabel')}
                    options={studentOptions}
                    placeholder={t('other.dialog.studentSelectPlaceholder')}
                    optional={false}
                  />
                )}
              </form.AppField>
              <form.AppField name="purpose">
                {(field) => (
                  <field.TextField
                    label={t('other.dialog.purposeLabel')}
                    placeholder={t('other.dialog.purposePlaceholder')}
                  />
                )}
              </form.AppField>
              {templateFields.length > 0 && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {t('other.dialog.autoPopulatedTitle')}
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {templateFields.map((field) => (
                      <Field key={field}>
                        <FieldLabel htmlFor={`cert-field-${field}`}>
                          {t(`other.dialog.fields.${field}`, { default: field })}
                        </FieldLabel>
                        <Input
                          id={`cert-field-${field}`}
                          readOnly
                          value={resolveFieldValue(field)}
                          className="bg-background"
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              )}
            </FieldGroup>
            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('actions.cancel')}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreview}
                  disabled={previewLoading || !templateId || !studentProfileId}
                >
                  {previewLoading ? t('other.dialog.previewing') : t('other.dialog.preview')}
                </Button>
                <form.AppForm>
                  <form.SubmitButton submittingLabel={t('other.dialog.submitting')}>
                    {t('other.dialog.issue')}
                  </form.SubmitButton>
                </form.AppForm>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('other.dialog.previewTitle')}</DialogTitle>
            <DialogDescription>{t('other.dialog.previewDescription')}</DialogDescription>
          </DialogHeader>
          <div className="h-[60vh] w-full overflow-hidden rounded-md border bg-background">
            <iframe
              title={t('other.dialog.previewTitle')}
              srcDoc={previewHtml ?? ''}
              className="h-full w-full"
              sandbox=""
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
              {t('other.dialog.previewClose')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
