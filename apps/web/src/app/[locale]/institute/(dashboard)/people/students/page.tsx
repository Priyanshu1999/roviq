'use client';

import type { AcademicStatus, Gender, SocialCategory } from '@roviq/graphql/generated';
import { useFormatDate, useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  Checkbox,
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
  PageHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ResponsiveDataTable,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useDebounce,
} from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertCircle,
  ArrowRightCircle,
  ArrowUpCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Download,
  GraduationCap,
  MoveRight,
  Plus,
  Search,
  SearchX,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { useMediaQuery } from '../../../../../../hooks/use-media-query';
import {
  type SectionPickerNode,
  type StandardPickerNode,
  type StudentListFilter,
  type StudentListNode,
  useAcademicYearsForStudents,
  useSectionsForStandard,
  useStandardsForYear,
  useStudents,
  useStudentsExport,
  useStudentsInTenantUpdated,
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
 * Status → lucide icon map. Paired with color via STATUS_CLASS to satisfy
 * a11y rule [RVSBJ] (color + icon always — never color alone).
 */
const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  ENROLLED: CheckCircle2,
  PROMOTED: ArrowUpCircle,
  DETAINED: AlertCircle,
  TRANSFERRED_OUT: ArrowRightCircle,
  DROPPED_OUT: XCircle,
  PASSED_OUT: GraduationCap,
};

/** Sort directive helpers — serialised into the `orderBy` filter param. */
type SortDir = 'asc' | 'desc' | null;
const SORTABLE_COLUMNS = [
  'admissionNumber',
  'admissionDate',
  'academicStatus',
  'createdAt',
] as const;
type SortableColumn = (typeof SORTABLE_COLUMNS)[number];

function parseSortDirective(directive: string | null): {
  column: SortableColumn | null;
  dir: SortDir;
} {
  if (!directive) return { column: null, dir: null };
  const [field, dir] = directive.split(':');
  if (!SORTABLE_COLUMNS.includes(field as SortableColumn)) {
    return { column: null, dir: null };
  }
  if (dir !== 'asc' && dir !== 'desc') return { column: null, dir: null };
  return { column: field as SortableColumn, dir };
}

/** Cycle asc → desc → cleared for the clicked column. */
function cycleSort(current: string | null, column: SortableColumn): string | null {
  const { column: c, dir } = parseSortDirective(current);
  if (c !== column) return `${column}:asc`;
  if (dir === 'asc') return `${column}:desc`;
  return null;
}

// ─── Filter toolbar (extracted to keep StudentsPage complexity under control)

interface StudentsFilterToolbarProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  filters: {
    academicYearId: string | null;
    standardId: string | null;
    sectionId: string | null;
    academicStatus: string[] | null;
    gender: string | null;
    socialCategory: string | null;
    isRteAdmitted: boolean | null;
  };
  effectiveYearId: string | null;
  academicYears: { id: string; label: string; isActive: boolean }[];
  standardsList: StandardPickerNode[];
  filterSections: SectionPickerNode[];
  updateFilters: (patch: {
    search?: string | null;
    standardId?: string | null;
    sectionId?: string | null;
    academicYearId?: string | null;
    academicStatus?: string[] | null;
    gender?: string | null;
    socialCategory?: string | null;
    isRteAdmitted?: boolean | null;
    orderBy?: string | null;
  }) => void;
  hasFilters: boolean;
}

function StudentsFilterToolbar(props: StudentsFilterToolbarProps) {
  const resolveI18n = useI18nField();
  const {
    searchInput,
    setSearchInput,
    filters,
    effectiveYearId,
    academicYears,
    standardsList,
    filterSections,
    updateFilters,
    hasFilters,
  } = props;
  const t = useTranslations('students');
  const rteValue =
    filters.isRteAdmitted === true ? 'yes' : filters.isRteAdmitted === false ? 'no' : '__all__';
  return (
    <DataTableToolbar>
      <div className="relative flex-1">
        <Search
          aria-hidden="true"
          className="absolute start-2.5 top-2 size-4 text-muted-foreground"
        />
        <Input
          data-testid={testIds.instituteStudents.searchInput}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('filters.search')}
          className="ps-8"
        />
      </div>
      <Select
        value={effectiveYearId ?? '__none__'}
        onValueChange={(v) =>
          updateFilters({
            academicYearId: v === '__none__' ? null : v,
            standardId: null,
            sectionId: null,
          })
        }
      >
        <SelectTrigger className="w-[160px]" aria-label={t('filters.academicYear')}>
          <SelectValue placeholder={t('filters.academicYear')} />
        </SelectTrigger>
        <SelectContent>
          {academicYears.length === 0 && (
            <SelectItem value="__none__" disabled>
              {t('filters.noYears')}
            </SelectItem>
          )}
          {academicYears.map((y) => (
            <SelectItem key={y.id} value={y.id}>
              {y.label}
              {y.isActive ? ` · ${t('filters.activeYearMarker')}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.standardId ?? '__all__'}
        onValueChange={(v) =>
          updateFilters({ standardId: v === '__all__' ? null : v, sectionId: null })
        }
      >
        <SelectTrigger className="w-[160px]" aria-label={t('filters.standard')}>
          <SelectValue placeholder={t('filters.allStandards')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allStandards')}</SelectItem>
          {standardsList.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {resolveI18n(s.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.sectionId ?? '__all__'}
        onValueChange={(v) => updateFilters({ sectionId: v === '__all__' ? null : v })}
        disabled={!filters.standardId}
      >
        <SelectTrigger className="w-[160px]" aria-label={t('filters.section')}>
          <SelectValue placeholder={t('filters.allSections')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allSections')}</SelectItem>
          {filterSections.map((sec) => (
            <SelectItem key={sec.id} value={sec.id}>
              {sec.displayLabel ?? resolveI18n(sec.name)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-[170px] justify-between"
            data-testid={testIds.instituteStudents.statusFilter}
          >
            <span className="truncate">
              {filters.academicStatus && filters.academicStatus.length > 0
                ? t('filters.statusesSelected', { count: filters.academicStatus.length })
                : t('filters.allStatuses')}
            </span>
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1">
            {ACADEMIC_STATUSES.map((s) => {
              const selected = filters.academicStatus?.includes(s) ?? false;
              const toggle = () => {
                const current = filters.academicStatus ?? [];
                const next = selected ? current.filter((x) => x !== s) : [...current, s];
                updateFilters({ academicStatus: next.length > 0 ? next : null });
              };
              return (
                <button
                  type="button"
                  key={s}
                  onClick={toggle}
                  aria-pressed={selected}
                  data-testid={testIds.instituteStudents.statusOption(s)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-start text-sm hover:bg-accent"
                >
                  <span
                    role="presentation"
                    className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary"
                  >
                    {selected && <Check className="size-3" />}
                  </span>
                  <span>{t(`academicStatuses.${s}`)}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Select
        value={filters.gender ?? '__all__'}
        onValueChange={(v) => updateFilters({ gender: v === '__all__' ? null : v })}
      >
        <SelectTrigger
          className="w-[130px]"
          aria-label={t('filters.allGenders')}
          data-testid={testIds.instituteStudents.genderFilter}
        >
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
        <SelectTrigger
          className="w-[150px]"
          aria-label={t('filters.allCategories')}
          data-testid={testIds.instituteStudents.categoryFilter}
        >
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
        value={rteValue}
        onValueChange={(v) =>
          updateFilters({
            isRteAdmitted: v === 'yes' ? true : v === 'no' ? false : null,
          })
        }
      >
        <SelectTrigger
          className="w-[130px]"
          aria-label={t('filters.rteAny')}
          data-testid={testIds.instituteStudents.rteFilter}
        >
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
          data-testid={testIds.instituteStudents.clearFiltersBtn}
          onClick={() => {
            setSearchInput('');
            updateFilters({
              search: null,
              standardId: null,
              sectionId: null,
              academicYearId: null,
              academicStatus: null,
              gender: null,
              socialCategory: null,
              isRteAdmitted: null,
              orderBy: null,
            });
          }}
        >
          <X aria-hidden="true" className="me-1 size-4" />
          {t('filters.clear')}
        </Button>
      )}
    </DataTableToolbar>
  );
}

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
  academicYearId: parseAsString,
  /** Multi-select academic status as URL array. */
  academicStatus: parseAsArrayOf(parseAsString),
  gender: parseAsString,
  socialCategory: parseAsString,
  isRteAdmitted: parseAsBoolean,
  /** Persisted page-size selection ([INREX] "Persist via nuqs"). */
  size: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
  /** Sort directive like `admissionNumber:asc`. */
  orderBy: parseAsString,
};

export default function StudentsPage() {
  const t = useTranslations('students');
  const { formatDistance } = useFormatDate();
  const resolveI18n = useI18nField();
  const router = useRouter();
  const [filters, setFilters] = useQueryStates(filterParsers);
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  // [JQGQM] — debounce at 150ms for snappy response.
  const debouncedSearch = useDebounce(searchInput, 150);

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
    if (filters.academicYearId) f.academicYearId = filters.academicYearId;
    if (filters.academicStatus && filters.academicStatus.length > 0) {
      f.academicStatus = filters.academicStatus as AcademicStatus[];
    }
    if (filters.gender) f.gender = filters.gender as Gender;
    if (filters.socialCategory) f.socialCategory = filters.socialCategory as SocialCategory;
    if (typeof filters.isRteAdmitted === 'boolean') f.isRteAdmitted = filters.isRteAdmitted;
    if (filters.orderBy) f.orderBy = filters.orderBy;
    return f;
  }, [filters, currentCursor]);

  const { students, totalCount, hasNextPage, loading, refetch } = useStudents(queryFilter);

  // Live tenant-wide updates — refetch list on every `STUDENT.updated` event.
  useStudentsInTenantUpdated(() => {
    refetch();
  });

  // ── Standards / academic years for filter dropdowns ─────────────────────
  const { data: yearsData } = useAcademicYearsForStudents();
  const academicYears = yearsData?.academicYears ?? [];
  // Default filter to the active year when nothing is selected in the URL.
  const activeYear = academicYears.find((y) => y.isActive) ?? null;
  const effectiveYearId = filters.academicYearId ?? activeYear?.id ?? null;
  const { data: standardsData } = useStandardsForYear(effectiveYearId);
  const standardsList = standardsData?.standards ?? [];
  const { data: filterSectionsData } = useSectionsForStandard(filters.standardId);
  const filterSections = filterSectionsData?.sections ?? [];

  // ── Sort state (derived from filters.orderBy) ───────────────────────────
  const sort = React.useMemo(() => parseSortDirective(filters.orderBy), [filters.orderBy]);
  const handleSort = React.useCallback(
    (column: SortableColumn) => {
      const next = cycleSort(filters.orderBy, column);
      setFilters({ orderBy: next });
      setCursorHistory([undefined]);
    },
    [filters.orderBy, setFilters],
  );

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

  // Renders a sortable column header: text + sort chevron that cycles
  // asc/desc/none. Uses a real <button> for accessibility.
  const SortableHeader = React.useCallback(
    ({ column, label, testId }: { column: SortableColumn; label: string; testId?: string }) => {
      const isActive = sort.column === column;
      const Icon =
        isActive && sort.dir === 'asc'
          ? ChevronUp
          : isActive && sort.dir === 'desc'
            ? ChevronDown
            : ChevronsUpDown;
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleSort(column);
          }}
          className="inline-flex items-center gap-1 font-medium hover:text-foreground"
          title={label}
          data-testid={testId}
        >
          {label}
          <Icon className={`size-3.5 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
        </button>
      );
    },
    [sort.column, sort.dir, handleSort],
  );

  const guardianName = React.useCallback(
    (s: StudentListNode) => {
      const first = s.primaryGuardianFirstName ? resolveI18n(s.primaryGuardianFirstName) : '';
      const last = s.primaryGuardianLastName ? resolveI18n(s.primaryGuardianLastName) : '';
      return [first, last].filter(Boolean).join(' ');
    },
    [resolveI18n],
  );

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
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={() => toggleRow(row.original.id)}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            aria-label={t('bulk.selectRow')}
          />
        ),
      },
      {
        accessorKey: 'admissionNumber',
        header: () => (
          <SortableHeader
            column="admissionNumber"
            label={t('columns.admissionNumber')}
            testId="students-sort-admission-btn"
          />
        ),
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
        id: 'classSection',
        header: t('columns.classSection'),
        cell: ({ row }) => {
          const std = resolveI18n(row.original.currentStandardName);
          const sec = resolveI18n(row.original.currentSectionName);
          if (!std && !sec) {
            return (
              <span className="text-sm text-muted-foreground">{t('columns.notAssigned')}</span>
            );
          }
          return (
            <span className="text-sm">
              {std ?? ''}
              {std && sec ? ' · ' : ''}
              {sec ?? ''}
            </span>
          );
        },
      },
      {
        id: 'primaryGuardian',
        header: t('columns.primaryGuardian'),
        cell: ({ row }) => {
          const name = guardianName(row.original);
          return name ? (
            <span className="text-sm">{name}</span>
          ) : (
            <span className="text-sm text-muted-foreground">{t('columns.notAssigned')}</span>
          );
        },
      },
      {
        accessorKey: 'academicStatus',
        header: () => <SortableHeader column="academicStatus" label={t('columns.status')} />,
        cell: ({ row }) => {
          const statusKey = row.original.academicStatus.toUpperCase();
          const Icon = STATUS_ICON[statusKey] ?? CheckCircle2;
          return (
            <Badge
              variant="secondary"
              className={`inline-flex items-center gap-1 ${STATUS_CLASS[statusKey] ?? ''}`}
            >
              <Icon className="size-3.5" />
              {t(`academicStatuses.${statusKey}`, {
                default: row.original.academicStatus,
              })}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'gender',
        header: t('columns.gender'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.gender ? t(`genders.${row.original.gender}`) : '—'}
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
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1 border-emerald-300 text-emerald-700"
            >
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              {t('rte.yes')}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: 'admissionDate',
        header: () => <SortableHeader column="admissionDate" label={t('columns.admittedOn')} />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(new Date(row.original.admissionDate))}
          </span>
        ),
      },
    ],
    [
      t,
      fullName,
      guardianName,
      formatDate,
      resolveI18n,
      allOnPageSelected,
      togglePage,
      toggleRow,
      selectedIds,
      SortableHeader,
    ],
  );

  // CSV export — runs a dedicated large-window lazy query so the exported
  // file reflects every filter/sort currently applied, not just the loaded
  // page. When the user has selected specific rows, we still honour the
  // selection and export only those. Only columns visible in the UI are
  // included to avoid surprise PII leaks.
  const [runExportQuery, { loading: exportLoading }] = useStudentsExport();

  const writeCsv = React.useCallback(
    (rows: StudentListNode[]) => {
      if (rows.length === 0) {
        toast.error(t('export.noRows'));
        return;
      }
      const header = [
        t('columns.admissionNumber'),
        t('columns.name'),
        t('columns.classSection'),
        t('columns.primaryGuardian'),
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
            [resolveI18n(s.currentStandardName) ?? '', resolveI18n(s.currentSectionName) ?? '']
              .filter(Boolean)
              .join(' · '),
            guardianName(s),
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
    },
    [fullName, guardianName, resolveI18n, t],
  );

  const handleExportCsv = React.useCallback(async () => {
    // Selected rows take precedence — export only those.
    if (selectedIds.size > 0) {
      writeCsv(students.filter((s) => selectedIds.has(s.id)));
      return;
    }
    // Otherwise fetch the full filtered set via the dedicated lazy query.
    const exportFilter: StudentListFilter = { ...queryFilter, first: 10000, after: undefined };
    const result = await runExportQuery({ variables: { filter: exportFilter } });
    const fetched = result.data?.listStudents.edges.map((e) => e.node) ?? [];
    writeCsv(fetched);
  }, [selectedIds, students, queryFilter, runExportQuery, writeCsv]);

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
            <PageHeader
              title={<span data-testid={testIds.instituteStudents.title}>{t('title')}</span>}
              description={
                <span data-testid={testIds.instituteStudents.description}>{t('description')}</span>
              }
              actions={
                <>
                  <Button
                    variant="outline"
                    onClick={handleExportCsv}
                    disabled={exportLoading}
                    data-testid={testIds.instituteStudents.exportBtn}
                  >
                    <Download aria-hidden="true" className="size-4" />
                    {exportLoading
                      ? t('export.loading')
                      : selectedIds.size > 0
                        ? t('export.buttonSelected', { count: selectedIds.size })
                        : t('export.buttonAll')}
                  </Button>
                  <Can I="create" a="Student">
                    <Button
                      onClick={() => router.push('/institute/people/students/new')}
                      data-testid={testIds.instituteStudents.newBtn}
                    >
                      <Plus aria-hidden="true" className="size-4" />
                      {t('addStudent')}
                    </Button>
                  </Can>
                </>
              }
            />

            <StudentsFilterToolbar
              searchInput={searchInput}
              setSearchInput={setSearchInput}
              filters={filters}
              effectiveYearId={effectiveYearId}
              academicYears={academicYears}
              standardsList={standardsList}
              filterSections={filterSections}
              updateFilters={updateFilters}
              hasFilters={hasFilters}
            />

            <BulkSectionChangeDialog
              open={bulkSectionOpen}
              onOpenChange={setBulkSectionOpen}
              students={selectedStudents}
              onSuccess={() => {
                setSelectedIds(new Set());
                refetch();
              }}
            />

            <ResponsiveDataTable
              data-testid={testIds.instituteStudents.table}
              columns={columns}
              data={students}
              isLoading={loading && students.length === 0}
              onRowClick={(row) => router.push(`/institute/people/students/${row.id}`)}
              mobileCard={(student) => {
                const std = resolveI18n(student.currentStandardName);
                const sec = resolveI18n(student.currentSectionName);
                const classSection =
                  !std && !sec
                    ? t('columns.notAssigned')
                    : `${std ?? ''}${std && sec ? ' · ' : ''}${sec ?? ''}`;
                const statusKey = student.academicStatus.toUpperCase();
                return (
                  <Link
                    href={`/institute/people/students/${student.id}`}
                    data-testid={testIds.instituteStudents.studentCard(student.id)}
                    className="block min-h-[44px] space-y-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="font-medium">{fullName(student)}</div>
                    <div className="text-sm text-muted-foreground">
                      {t('columns.admissionNumber')}: {student.admissionNumber}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('columns.classSection')}: {classSection}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('columns.status')}:{' '}
                      {t(`academicStatuses.${statusKey}`, { default: student.academicStatus })}
                    </div>
                  </Link>
                );
              }}
              emptyState={
                hasFilters ? (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchX />
                      </EmptyMedia>
                      <EmptyTitle data-testid={testIds.instituteStudents.emptyState}>
                        {t('empty.noMatch')}
                      </EmptyTitle>
                      <EmptyDescription>{t('empty.noMatchDescription')}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <GraduationCap aria-hidden="true" />
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
                          <MoveRight aria-hidden="true" className="size-4" />
                          {t('bulk.changeSection')}
                        </Button>
                      </Can>
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedIds(new Set())}
                        title={t('bulk.clearSelection')}
                      >
                        <X aria-hidden="true" className="size-4" />
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
  const resolveI18n = useI18nField();
  const [updateStudentSection, { loading }] = useUpdateStudentSection();
  const [targetSectionId, setTargetSectionId] = React.useState('');
  const [overrideReason, setOverrideReason] = React.useState('');
  // Rule [QIGCL]: Desktop = Dialog, Mobile (<lg) = bottom Sheet.
  const isMobile = useMediaQuery('(max-width: 1024px)');

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

  // The inner form body — identical markup in both Dialog and Sheet shells.
  const body = (
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
                    {section.displayLabel ?? resolveI18n(section.name)}
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
  );

  // Rule [QIGCL]: on mobile (<lg) render as bottom Sheet with scrollable body
  // and sticky footer; on desktop render as Dialog. Contents are identical.
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('bulk.dialogTitle')}</SheetTitle>
            <SheetDescription>
              {t('bulk.dialogDescription', { count: students.length })}
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-24">{body}</div>

          <SheetFooter className="sticky bottom-0 border-t bg-background pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('bulk.cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {loading ? t('bulk.applying') : t('bulk.apply')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('bulk.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('bulk.dialogDescription', { count: students.length })}
          </DialogDescription>
        </DialogHeader>

        {body}

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
            <SelectTrigger
              className="w-[80px]"
              aria-label={t('pagination.rowsPerPage')}
              data-testid={testIds.instituteStudents.pageSizeSelect}
            >
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
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={!canGoNext}
            title={t('pagination.next')}
            aria-label={t('pagination.next')}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
