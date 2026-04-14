'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { TcStatus } from '@roviq/graphql/generated';
import { useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  DataTable,
  DataTableToolbar,
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
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useDebounce,
} from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertCircle,
  Award,
  Award as AwardIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eraser,
  FileText,
  Plus,
  Search,
  SearchX,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  type TCListFilter,
  type TCNode,
  useAcademicYearsForCertificates,
  useRequestTC,
  useStudentPicker,
  useTCs,
} from '../use-certificates';

/**
 * 10-status TC lifecycle — mirrors the tc_register.status state machine
 * defined in the backend domain layer.
 */
const TC_STATUSES = [
  'REQUESTED',
  'CLEARANCE_PENDING',
  'CLEARED',
  'APPROVED',
  'COUNTERSIGNED',
  'ISSUED',
  'DUPLICATE_ISSUED',
  'REJECTED',
  'RETURNED',
  'CANCELLED',
] as const;

const STATUS_CLASS: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  CLEARANCE_PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  CLEARED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  APPROVED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  COUNTERSIGNED: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  ISSUED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  DUPLICATE_ISSUED: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  RETURNED: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  REQUESTED: Clock,
  CLEARANCE_PENDING: AlertCircle,
  CLEARED: ShieldCheck,
  APPROVED: Sparkles,
  COUNTERSIGNED: Award,
  ISSUED: CheckCircle2,
  DUPLICATE_ISSUED: AwardIcon,
  REJECTED: XCircle,
  RETURNED: Send,
  CANCELLED: Eraser,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

const filterParsers = {
  search: parseAsString,
  status: parseAsArrayOf(parseAsString),
  size: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
};

/** Pad a Date to DD/MM/YYYY — locale-independent per frontend-ux [GYATP]. */
function formatDdMmYyyy(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function TCListPage() {
  const t = useTranslations('certificates');
  const resolveI18n = useI18nField();
  const router = useRouter();
  const [filters, setFilters] = useQueryStates(filterParsers);
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 150);
  const [requestOpen, setRequestOpen] = React.useState(false);
  const [pageIndex, setPageIndex] = React.useState(0);

  React.useEffect(() => {
    setFilters({ search: debouncedSearch || null });
    setPageIndex(0);
  }, [debouncedSearch, setFilters]);

  const queryFilter = React.useMemo<TCListFilter>(() => {
    // Backend currently supports single status filter — pick first when multi-selected.
    const f: TCListFilter = {};
    if (filters.status && filters.status.length > 0) f.status = filters.status[0] as TcStatus;
    return f;
  }, [filters.status]);

  const { tcs, loading, refetch } = useTCs(queryFilter);

  // Client-side search over serial number + reason (backend doesn't support search).
  const filteredTcs = React.useMemo(() => {
    if (!filters.search) return tcs;
    const q = filters.search.toLowerCase();
    return tcs.filter(
      (tc) => tc.tcSerialNumber.toLowerCase().includes(q) || tc.reason.toLowerCase().includes(q),
    );
  }, [tcs, filters.search]);

  // Client-side windowed pagination (backend returns flat list, not cursor page).
  const pagedTcs = React.useMemo(() => {
    const start = pageIndex * filters.size;
    return filteredTcs.slice(start, start + filters.size);
  }, [filteredTcs, pageIndex, filters.size]);

  const totalCount = filteredTcs.length;
  const hasNextPage = (pageIndex + 1) * filters.size < totalCount;

  const columns = React.useMemo<ColumnDef<TCNode>[]>(
    () => [
      {
        accessorKey: 'tcSerialNumber',
        header: t('columns.serialNumber'),
        cell: ({ row }) => (
          <span className="font-mono text-xs font-medium">{row.original.tcSerialNumber}</span>
        ),
      },
      {
        id: 'studentName',
        header: t('columns.studentName'),
        cell: ({ row }) => {
          const name = [
            resolveI18n(row.original.studentFirstName),
            resolveI18n(row.original.studentLastName),
          ]
            .filter(Boolean)
            .join(' ');
          return <span className="text-sm font-medium">{name || '—'}</span>;
        },
      },
      {
        id: 'class',
        accessorKey: 'currentStandardName',
        header: t('columns.class'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {resolveI18n(row.original.currentStandardName) ?? '—'}
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
              {t(`tcStatuses.${status}`, { default: status })}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'reason',
        header: t('columns.reason'),
        cell: ({ row }) => (
          <span
            className="block max-w-xs truncate text-sm text-muted-foreground"
            title={row.original.reason}
          >
            {row.original.reason}
          </span>
        ),
      },
      {
        id: 'duplicate',
        header: t('columns.type'),
        cell: ({ row }) =>
          row.original.isDuplicate ? (
            <Badge variant="outline" className="text-xs">
              {t('duplicate')}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">{t('original')}</span>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: t('columns.createdAt'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDdMmYyyy(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [t, resolveI18n],
  );

  const hasFilters = Boolean(filters.search || (filters.status && filters.status.length > 0));

  return (
    <Can I="read" a="TC" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="tc-title">
                  {t('tc.title')}
                </h1>
                <p className="text-muted-foreground">{t('tc.description')}</p>
              </div>
              <Can I="create" a="TC">
                <Button onClick={() => setRequestOpen(true)}>
                  <Plus className="size-4" />
                  {t('tc.requestButton')}
                </Button>
              </Can>
            </div>

            <DataTableToolbar>
              <div className="relative flex-1">
                <Search className="absolute start-2.5 top-2 size-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t('filters.searchPlaceholder')}
                  className="ps-8"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[190px] justify-between">
                    <span className="truncate">
                      {filters.status && filters.status.length > 0
                        ? t('filters.statusesSelected', { count: filters.status.length })
                        : t('filters.allStatuses')}
                    </span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-2" align="start">
                  <div className="space-y-1">
                    {TC_STATUSES.map((s) => {
                      const selected = filters.status?.includes(s) ?? false;
                      const toggle = () => {
                        const current = filters.status ?? [];
                        const next = selected ? current.filter((x) => x !== s) : [...current, s];
                        setFilters({ status: next.length > 0 ? next : null });
                        setPageIndex(0);
                      };
                      const Icon = STATUS_ICON[s] ?? Clock;
                      return (
                        <button
                          type="button"
                          key={s}
                          onClick={toggle}
                          aria-pressed={selected}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-accent"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            readOnly
                            className="size-4"
                            aria-hidden
                          />
                          <Icon className="size-3.5 text-muted-foreground" />
                          <span>{t(`tcStatuses.${s}`, { default: s })}</span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setFilters({ search: null, status: null });
                    setPageIndex(0);
                  }}
                >
                  {t('filters.clear')}
                </Button>
              )}
            </DataTableToolbar>

            <DataTable
              columns={columns}
              data={pagedTcs}
              data-testid="tc-table"
              isLoading={loading && tcs.length === 0}
              stickyFirstColumn
              skeletonRows={8}
              onRowClick={(row) => router.push(`/institute/certificates/tc/${row.id}`)}
              emptyState={
                hasFilters ? (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchX />
                      </EmptyMedia>
                      <EmptyTitle>{t('empty.noMatch')}</EmptyTitle>
                      <EmptyDescription>{t('empty.noMatchDescription')}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileText />
                      </EmptyMedia>
                      <EmptyTitle>{t('tc.empty.noData')}</EmptyTitle>
                      <EmptyDescription>{t('tc.empty.noDataDescription')}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )
              }
            />

            <WindowedPagination
              pageIndex={pageIndex}
              pageSize={filters.size}
              currentCount={pagedTcs.length}
              totalCount={totalCount}
              hasNextPage={hasNextPage}
              loading={loading}
              onPrev={() => setPageIndex((p) => Math.max(0, p - 1))}
              onNext={() => setPageIndex((p) => p + 1)}
              onPageSizeChange={(s) => {
                setFilters({ size: s });
                setPageIndex(0);
              }}
            />

            <RequestTCDialog
              open={requestOpen}
              onOpenChange={setRequestOpen}
              onSuccess={() => refetch()}
            />
          </div>
        ) : null
      }
    </Can>
  );
}

// ─── Request TC Dialog ───────────────────────────────────────────────────────

const requestTCSchema = z.object({
  studentProfileId: z.string().min(1, 'Student is required'),
  academicYearId: z.string().min(1, 'Academic year is required'),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

type RequestTCForm = z.infer<typeof requestTCSchema>;

function RequestTCDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('certificates');
  const resolveI18n = useI18nField();
  const [studentSearch, setStudentSearch] = React.useState('');
  const debouncedSearch = useDebounce(studentSearch, 250);
  const { data: studentsData } = useStudentPicker(debouncedSearch);
  const { data: yearsData } = useAcademicYearsForCertificates();
  const [requestTC, { loading }] = useRequestTC();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RequestTCForm>({
    resolver: zodResolver(requestTCSchema),
    defaultValues: { studentProfileId: '', academicYearId: '', reason: '' },
  });

  React.useEffect(() => {
    if (open) {
      const activeYear = yearsData?.academicYears.find((y) => y.isActive);
      if (activeYear) setValue('academicYearId', activeYear.id);
    } else {
      reset();
      setStudentSearch('');
    }
  }, [open, yearsData, setValue, reset]);

  const students = studentsData?.listStudents.edges.map((e) => e.node) ?? [];
  const years = yearsData?.academicYears ?? [];

  const onSubmit = async (values: RequestTCForm) => {
    try {
      await requestTC({ variables: { input: values } });
      toast.success(t('tc.requestSuccess'));
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('tc.requestError'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('tc.requestDialog.title')}</DialogTitle>
          <DialogDescription>{t('tc.requestDialog.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="student-search">{t('tc.requestDialog.studentLabel')}</FieldLabel>
              <Input
                id="student-search"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder={t('tc.requestDialog.studentSearchPlaceholder')}
              />
              <Select
                value={watch('studentProfileId')}
                onValueChange={(v) => setValue('studentProfileId', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('tc.requestDialog.studentSelectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {students.length === 0 && (
                    <SelectItem value="__none__" disabled>
                      {t('tc.requestDialog.noStudents')}
                    </SelectItem>
                  )}
                  {students.map((s) => {
                    const name = [resolveI18n(s.firstName), resolveI18n(s.lastName)]
                      .filter(Boolean)
                      .join(' ');
                    const cls = [
                      resolveI18n(s.currentStandardName),
                      resolveI18n(s.currentSectionName),
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {s.admissionNumber} · {name}
                        {cls ? ` (${cls})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.studentProfileId && (
                <FieldError>{errors.studentProfileId.message}</FieldError>
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="academic-year">
                {t('tc.requestDialog.academicYearLabel')}
              </FieldLabel>
              <Select
                value={watch('academicYearId')}
                onValueChange={(v) => setValue('academicYearId', v, { shouldValidate: true })}
              >
                <SelectTrigger id="academic-year">
                  <SelectValue placeholder={t('tc.requestDialog.academicYearPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.label}
                      {y.isActive ? ` · ${t('filters.activeYearMarker')}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.academicYearId && <FieldError>{errors.academicYearId.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="tc-reason">{t('tc.requestDialog.reasonLabel')}</FieldLabel>
              <Textarea
                id="tc-reason"
                rows={4}
                placeholder={t('tc.requestDialog.reasonPlaceholder')}
                {...register('reason')}
              />
              {errors.reason && <FieldError>{errors.reason.message}</FieldError>}
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('tc.requestDialog.submitting') : t('tc.requestDialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Windowed Pagination (copied from students page pattern) ────────────────

function WindowedPagination({
  pageIndex,
  pageSize,
  currentCount,
  totalCount,
  hasNextPage,
  loading,
  onPrev,
  onNext,
  onPageSizeChange,
}: {
  pageIndex: number;
  pageSize: number;
  currentCount: number;
  totalCount: number;
  hasNextPage: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange: (size: number) => void;
}) {
  const t = useTranslations('certificates');
  const start = currentCount === 0 ? 0 : pageIndex * pageSize + 1;
  const end = pageIndex * pageSize + currentCount;
  const canGoPrev = pageIndex > 0 && !loading;
  const canGoNext = hasNextPage && !loading;

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{t('pagination.window', { start, end, total: totalCount })}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('pagination.rowsPerPage')}</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number.parseInt(v, 10))}
          >
            <SelectTrigger className="w-[80px]" aria-label={t('pagination.rowsPerPage')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={!canGoPrev}
            title={t('pagination.prev')}
            aria-label={t('pagination.prev')}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={!canGoNext}
            title={t('pagination.next')}
            aria-label={t('pagination.next')}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
