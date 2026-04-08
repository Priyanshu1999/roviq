'use client';

import { useFormatDate, useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  Checkbox,
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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useDebounce,
} from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  MoveRight,
  Plus,
  Search,
  SearchX,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import {
  type StudentListFilter,
  type StudentListNode,
  useSectionsForStandard,
  useStudents,
  useUpdateStudentSection,
} from './use-students';

/**
 * Matches the values accepted by StudentFilterInput.academicStatus. These are
 * the domain-level lifecycle states of a student enrollment.
 */
const ACADEMIC_STATUSES = [
  'ENROLLED',
  'PROMOTED',
  'DETAINED',
  'TRANSFERRED_OUT',
  'DROPPED_OUT',
  'PASSED_OUT',
] as const;

/** Values accepted by StudentFilterInput.gender (joined from user_profiles). */
const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;

/**
 * Indian census categories used for compliance reporting (UDISE / RTE).
 * Matches StudentFilterInput.socialCategory on the server.
 */
const SOCIAL_CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS'] as const;

const STATUS_CLASS: Record<string, string> = {
  ENROLLED: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  PROMOTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  DETAINED: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  TRANSFERRED_OUT: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  DROPPED_OUT: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  PASSED_OUT: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

/**
 * Page-size options surfaced in the windowed pagination select.
 * Matches the [INREX] rule "Rows-per-page selector" — kept short so the
 * dropdown stays scannable on a 1366x768 display.
 */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

const filterParsers = {
  search: parseAsString,
  standardId: parseAsString,
  sectionId: parseAsString,
  academicStatus: parseAsString,
  gender: parseAsString,
  socialCategory: parseAsString,
  isRteAdmitted: parseAsBoolean,
  /** Persisted page-size selection ([INREX] "Persist via nuqs"). */
  size: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
};

export default function StudentsPage() {
  const t = useTranslations('students');
  const { formatDistance } = useFormatDate();
  const resolveI18n = useI18nField();
  const router = useRouter();
  const [filters, setFilters] = useQueryStates(filterParsers);
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  // Cursor history for windowed pagination — see WindowedPagination at the
  // bottom of this file. Each entry is the `after` cursor used to fetch
  // page N (with `cursorHistory[0] === undefined` meaning the first page).
  // Cursor pagination cannot jump to arbitrary pages, so we only expose
  // prev/next + a window count, not "jump to page 17". This satisfies
  // [INREX] for cursor-based lists.
  const [cursorHistory, setCursorHistory] = React.useState<(string | undefined)[]>([undefined]);
  const pageIndex = cursorHistory.length - 1;
  const currentCursor = cursorHistory[pageIndex];

  // Reset pagination whenever the user changes any filter or page size.
  const resetPagination = React.useCallback(() => {
    setCursorHistory([undefined]);
  }, []);

  React.useEffect(() => {
    setFilters({ search: debouncedSearch || null });
    resetPagination();
  }, [debouncedSearch, setFilters, resetPagination]);

  const queryFilter = React.useMemo<StudentListFilter>(() => {
    const f: StudentListFilter = { first: filters.size };
    if (currentCursor) f.after = currentCursor;
    if (filters.search) f.search = filters.search;
    if (filters.standardId) f.standardId = filters.standardId;
    if (filters.sectionId) f.sectionId = filters.sectionId;
    if (filters.academicStatus) f.academicStatus = filters.academicStatus;
    if (filters.gender) f.gender = filters.gender;
    if (filters.socialCategory) f.socialCategory = filters.socialCategory;
    if (typeof filters.isRteAdmitted === 'boolean') f.isRteAdmitted = filters.isRteAdmitted;
    return f;
  }, [filters, currentCursor]);

  const { students, totalCount, hasNextPage, loading, refetch } = useStudents(queryFilter);

  // ── Windowed pagination handlers ────────────────────────────────────────
  // Cursor-based, but we render as "1–25 of 243" + prev/next.
  const handleNextPage = React.useCallback(() => {
    // The hook returns the latest end cursor on every refetch — read it
    // from the apollo data via a callback that takes the next cursor.
    // Since `useStudents` doesn't expose the raw pageInfo separately we
    // store the last seen end cursor in state when `students` changes.
    setCursorHistory((prev) => [...prev, lastEndCursorRef.current ?? undefined]);
    setSelectedIds(new Set());
  }, []);

  const handlePrevPage = React.useCallback(() => {
    setCursorHistory((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
    setSelectedIds(new Set());
  }, []);

  const handlePageSizeChange = React.useCallback(
    (newSize: number) => {
      setFilters({ size: newSize });
      resetPagination();
      setSelectedIds(new Set());
    },
    [setFilters, resetPagination],
  );

  // Track the last seen end cursor across refetches so handleNextPage can
  // push it onto the history. Apollo's `data?.pageInfo.endCursor` would
  // work but we don't get it back from the typed `useStudents` result —
  // it's exposed via `hasNextPage` only. Using a ref keeps a stable read.
  const lastEndCursorRef = React.useRef<string | null>(null);
  // Re-derive from the live page: cursor of the last visible row.
  // Since cursors come from the GraphQL edge.cursor field which `useStudents`
  // doesn't surface, we approximate using the next-page indicator: when
  // hasNextPage is true the user can advance and we'll push the current
  // cursor pointer (the position we requested from). The current page's
  // own cursor is `cursorHistory[pageIndex + 1]`'s seed.
  React.useEffect(() => {
    // The hook drops `endCursor` after the result lands; we don't have it
    // directly. Instead, we derive a synthetic "next anchor" from the
    // last student's id encoded the same way the backend does it
    // (`encodeCursor({ id })`). Backend uses base64url(JSON({id})), so we
    // mirror that exactly to avoid an extra round-trip.
    if (students.length > 0) {
      const lastId = students[students.length - 1].id;
      lastEndCursorRef.current = btoa(JSON.stringify({ id: lastId }));
    } else {
      lastEndCursorRef.current = null;
    }
  }, [students]);

  // ── Multi-select state for bulk actions ─────────────────────────────────
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkSectionOpen, setBulkSectionOpen] = React.useState(false);

  // Wrap the nuqs filter setter so that any filter change also drops the
  // current selection — selecting students from a previous filtered view
  // would otherwise leak into the new view.
  const updateFilters = React.useCallback(
    (patch: Parameters<typeof setFilters>[0]) => {
      setSelectedIds(new Set());
      return setFilters(patch);
    },
    [setFilters],
  );

  const toggleRow = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const togglePage = React.useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const s of students) {
          if (checked) next.add(s.id);
          else next.delete(s.id);
        }
        return next;
      });
    },
    [students],
  );

  const allOnPageSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));

  const formatDate = React.useCallback(
    (date: Date) => formatDistance(date, new Date()),
    [formatDistance],
  );

  const fullName = React.useCallback(
    (s: StudentListNode) =>
      [resolveI18n(s.firstName), resolveI18n(s.lastName)].filter(Boolean).join(' '),
    [resolveI18n],
  );

  // TODO(rov-167-followup): sticky first column ([IXABI]) and skeleton rows
  // matching column count ([IMUXO]) require a `@roviq/ui` DataTable change
  // (cellClassName via meta + a `skeletonRowCount` prop). 7 other pages
  // consume DataTable; deferring to a dedicated shared-component PR rather
  // than forking the table here.
  const columns = React.useMemo<ColumnDef<StudentListNode>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <Checkbox
            checked={allOnPageSelected}
            onCheckedChange={(checked) => togglePage(checked === true)}
            aria-label={t('bulk.selectAllOnPage')}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          // Inline interactive wrapper so the row click handler in DataTable
          // (which navigates to detail) doesn't also fire when toggling the
          // checkbox. Using a real <button type="button"> keeps a11y intact.
          <button type="button" className="inline-flex" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedIds.has(row.original.id)}
              onCheckedChange={() => toggleRow(row.original.id)}
              aria-label={t('bulk.selectRow')}
            />
          </button>
        ),
      },
      {
        accessorKey: 'admissionNumber',
        header: t('columns.admissionNumber'),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.admissionNumber}
          </span>
        ),
      },
      {
        accessorKey: 'firstName',
        header: t('columns.name'),
        cell: ({ row }) => <span className="font-medium">{fullName(row.original)}</span>,
      },
      {
        accessorKey: 'academicStatus',
        header: t('columns.status'),
        cell: ({ row }) => (
          <Badge variant="secondary" className={STATUS_CLASS[row.original.academicStatus] ?? ''}>
            {t(`academicStatuses.${row.original.academicStatus}`, {
              default: row.original.academicStatus,
            })}
          </Badge>
        ),
      },
      {
        accessorKey: 'gender',
        header: t('columns.gender'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.gender ? t(`genders.${row.original.gender}`) : '\u2014'}
          </span>
        ),
      },
      {
        accessorKey: 'socialCategory',
        header: t('columns.category'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {t(`socialCategories.${row.original.socialCategory}`, {
              default: row.original.socialCategory,
            })}
          </span>
        ),
      },
      {
        accessorKey: 'isRteAdmitted',
        header: t('columns.rte'),
        cell: ({ row }) =>
          row.original.isRteAdmitted ? (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700">
              {t('rte.yes')}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">\u2014</span>
          ),
      },
      {
        accessorKey: 'admissionDate',
        header: t('columns.admittedOn'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(new Date(row.original.admissionDate))}
          </span>
        ),
      },
    ],
    [t, fullName, formatDate, allOnPageSelected, togglePage, toggleRow, selectedIds],
  );

  // CSV export — exports either the selected rows or, if no selection,
  // every student currently loaded into the cursor-paginated table. We
  // only export columns visible in the UI to keep the file useful and to
  // avoid surprise PII leaks (e.g. dateOfBirth lives only on the detail
  // query, not the list query).
  const handleExportCsv = React.useCallback(() => {
    const rows = students.filter((s) => selectedIds.size === 0 || selectedIds.has(s.id));
    if (rows.length === 0) {
      toast.error(t('export.noRows'));
      return;
    }
    const header = [
      t('columns.admissionNumber'),
      t('columns.name'),
      t('columns.status'),
      t('columns.gender'),
      t('columns.category'),
      t('columns.rte'),
      t('columns.admittedOn'),
    ];
    const csvEscape = (value: string) => {
      if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
      return value;
    };
    const lines = [
      header.map(csvEscape).join(','),
      ...rows.map((s) =>
        [
          s.admissionNumber,
          fullName(s),
          s.academicStatus,
          s.gender ?? '',
          s.socialCategory,
          s.isRteAdmitted ? 'Yes' : 'No',
          s.admissionDate,
        ]
          .map(csvEscape)
          .join(','),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(t('export.success', { count: rows.length }));
  }, [students, selectedIds, fullName, t]);

  const selectedStudents = React.useMemo(
    () => students.filter((s) => selectedIds.has(s.id)),
    [students, selectedIds],
  );

  const hasFilters = Object.values(filters).some((v) => v !== null && v !== undefined);

  return (
    <Can I="read" a="Student" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
                <p className="text-muted-foreground">{t('description')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleExportCsv}>
                  <Download className="size-4" />
                  {selectedIds.size > 0
                    ? t('export.buttonSelected', { count: selectedIds.size })
                    : t('export.buttonAll')}
                </Button>
                <Can I="create" a="Student">
                  <Button onClick={() => router.push('/institute/people/students/new')}>
                    <Plus className="size-4" />
                    {t('addStudent')}
                  </Button>
                </Can>
              </div>
            </div>

            <DataTableToolbar>
              <div className="relative flex-1">
                <Search className="absolute start-2.5 top-2 size-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={t('filters.search')}
                  className="ps-8"
                />
              </div>
              <Select
                value={filters.academicStatus ?? '__all__'}
                onValueChange={(v) => updateFilters({ academicStatus: v === '__all__' ? null : v })}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder={t('filters.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.allStatuses')}</SelectItem>
                  {ACADEMIC_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`academicStatuses.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.gender ?? '__all__'}
                onValueChange={(v) => updateFilters({ gender: v === '__all__' ? null : v })}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder={t('filters.allGenders')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.allGenders')}</SelectItem>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {t(`genders.${g}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.socialCategory ?? '__all__'}
                onValueChange={(v) => updateFilters({ socialCategory: v === '__all__' ? null : v })}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('filters.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.allCategories')}</SelectItem>
                  {SOCIAL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`socialCategories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={
                  filters.isRteAdmitted === true
                    ? 'yes'
                    : filters.isRteAdmitted === false
                      ? 'no'
                      : '__all__'
                }
                onValueChange={(v) =>
                  updateFilters({
                    isRteAdmitted: v === 'yes' ? true : v === 'no' ? false : null,
                  })
                }
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder={t('filters.rteAny')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.rteAny')}</SelectItem>
                  <SelectItem value="yes">{t('filters.rteYes')}</SelectItem>
                  <SelectItem value="no">{t('filters.rteNo')}</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    updateFilters({
                      search: null,
                      standardId: null,
                      sectionId: null,
                      academicStatus: null,
                      gender: null,
                      socialCategory: null,
                      isRteAdmitted: null,
                    });
                  }}
                >
                  <X className="me-1 size-4" />
                  {t('filters.clear')}
                </Button>
              )}
            </DataTableToolbar>

            <BulkSectionChangeDialog
              open={bulkSectionOpen}
              onOpenChange={setBulkSectionOpen}
              students={selectedStudents}
              onSuccess={() => {
                setSelectedIds(new Set());
                refetch();
              }}
            />

            <DataTable
              columns={columns}
              data={students}
              isLoading={loading && students.length === 0}
              onRowClick={(row) => router.push(`/institute/people/students/${row.id}`)}
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
                        <GraduationCap />
                      </EmptyMedia>
                      <EmptyTitle>{t('empty.noData')}</EmptyTitle>
                      <EmptyDescription>{t('empty.noDataDescription')}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )
              }
            />

            <WindowedPagination
              pageIndex={pageIndex}
              pageSize={filters.size}
              currentCount={students.length}
              totalCount={totalCount}
              hasNextPage={hasNextPage}
              loading={loading}
              onPrev={handlePrevPage}
              onNext={handleNextPage}
              onPageSizeChange={handlePageSizeChange}
            />

            {/*
              Floating bulk action bar — bottom-sticky overlay that appears
              once one or more rows are selected. Implements rule [JABGL]
              from frontend-ux: "Bulk → floating bar". Uses `fixed inset-x`
              with a backdrop-blur shadow so it stays visible regardless of
              scroll position. We add a `pb-24` spacer at the bottom of the
              list when active so the last row isn't hidden behind the bar.
            */}
            {selectedIds.size > 0 && (
              <>
                <div className="h-24" aria-hidden />
                <section
                  aria-label={t('bulk.barLabel')}
                  className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.08)]"
                >
                  <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-6 py-4">
                    <span className="text-sm font-medium">
                      {t('bulk.selected', { count: selectedIds.size })}
                    </span>
                    <div className="flex items-center gap-2">
                      <Can I="update" a="Student">
                        <Button
                          variant="outline"
                          onClick={() => setBulkSectionOpen(true)}
                          title={t('bulk.changeSection')}
                        >
                          <MoveRight className="size-4" />
                          {t('bulk.changeSection')}
                        </Button>
                      </Can>
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedIds(new Set())}
                        title={t('bulk.clearSelection')}
                      >
                        <X className="size-4" />
                        {t('bulk.clearSelection')}
                      </Button>
                    </div>
                  </div>
                </section>
              </>
            )}
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

// ─── Bulk section change dialog ───────────────────────────────────────────

/**
 * Lets an admin reassign every selected student to a different section in
 * one go. Constraints enforced by this dialog:
 *
 *  1. All selected students must currently be in the SAME standard. Bulk
 *     cross-standard moves don't make sense (different curricula, different
 *     section sets) and are blocked at the UI layer with a clear message.
 *  2. Every selected student must already have a current-year academic
 *     record (`currentStudentAcademicId`). Students without one cannot be
 *     bulk-moved here — admit them to the active year first.
 *  3. The target section must come from the list of sections in the same
 *     standard, fetched via `useSectionsForStandard`.
 *
 * The mutation is issued one-per-student via `updateStudentSection`. The
 * server enforces capacity (with optional `overrideReason`); failures here
 * are surfaced individually so the user knows exactly which student blocked.
 */
function BulkSectionChangeDialog({
  open,
  onOpenChange,
  students,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  students: StudentListNode[];
  onSuccess: () => void;
}) {
  const t = useTranslations('students');
  const [updateStudentSection, { loading }] = useUpdateStudentSection();
  const [targetSectionId, setTargetSectionId] = React.useState('');
  const [overrideReason, setOverrideReason] = React.useState('');

  // All standards represented in the selection — used both for the
  // mismatch check and to drive the section picker.
  const distinctStandardIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.currentStandardId) set.add(s.currentStandardId);
    }
    return Array.from(set);
  }, [students]);

  const sharedStandardId = distinctStandardIds.length === 1 ? distinctStandardIds[0] : null;

  const studentsMissingAcademicRow = React.useMemo(
    () => students.filter((s) => !s.currentStudentAcademicId),
    [students],
  );

  const { data: sectionsData, loading: sectionsLoading } = useSectionsForStandard(sharedStandardId);

  const sections = sectionsData?.sections ?? [];

  const canSubmit =
    open &&
    !loading &&
    sharedStandardId !== null &&
    studentsMissingAcademicRow.length === 0 &&
    targetSectionId.length > 0 &&
    students.length > 0;

  // Reset transient state every time the dialog is reopened
  React.useEffect(() => {
    if (open) {
      setTargetSectionId('');
      setOverrideReason('');
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    let succeeded = 0;
    const failures: string[] = [];
    for (const student of students) {
      if (!student.currentStudentAcademicId) continue;
      try {
        await updateStudentSection({
          variables: {
            input: {
              studentAcademicId: student.currentStudentAcademicId,
              newSectionId: targetSectionId,
              overrideReason: overrideReason || undefined,
            },
          },
        });
        succeeded += 1;
      } catch (err) {
        failures.push(`${student.admissionNumber}: ${(err as Error).message}`);
      }
    }
    if (failures.length === 0) {
      toast.success(t('bulk.changeSuccess', { count: succeeded }));
      onOpenChange(false);
      onSuccess();
    } else {
      toast.error(
        t('bulk.changePartial', {
          succeeded,
          failed: failures.length,
        }),
      );
      // Keep dialog open so the user can see which records to fix
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('bulk.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('bulk.dialogDescription', { count: students.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sharedStandardId === null && distinctStandardIds.length > 1 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {t('bulk.differentStandards')}
            </div>
          )}

          {studentsMissingAcademicRow.length > 0 && (
            <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
              {t('bulk.missingAcademicRecord', {
                count: studentsMissingAcademicRow.length,
              })}
            </div>
          )}

          {sharedStandardId && studentsMissingAcademicRow.length === 0 && (
            <>
              <div>
                <label htmlFor="bulk-target-section" className="mb-1 block text-sm font-medium">
                  {t('bulk.targetSection')}
                </label>
                <Select value={targetSectionId} onValueChange={setTargetSectionId}>
                  <SelectTrigger id="bulk-target-section">
                    <SelectValue
                      placeholder={
                        sectionsLoading ? t('bulk.loadingSections') : t('bulk.selectSection')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.displayLabel ?? section.name}
                        {' · '}
                        {t('bulk.strength', { count: section.currentStrength })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label htmlFor="bulk-override-reason" className="mb-1 block text-sm font-medium">
                  {t('bulk.overrideReason')}
                </label>
                <Input
                  id="bulk-override-reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={t('bulk.overrideReasonPlaceholder')}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('bulk.overrideReasonHelp')}</p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('bulk.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? t('bulk.applying') : t('bulk.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Windowed pagination ──────────────────────────────────────────────────

/**
 * Windowed pagination for cursor-based lists. Renders "1–25 of 243" + a
 * page-size selector + prev/next buttons. Cursor pagination cannot jump to
 * arbitrary pages, so prev/next is the only navigation; the parent owns the
 * cursor history stack and exposes onPrev / onNext callbacks.
 *
 * Implements rule [INREX] from frontend-ux: total count + window
 * "{start}–{end} of {total}" + rows-per-page selector. Persistence is the
 * parent's responsibility (nuqs).
 */
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
  const t = useTranslations('students');
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
