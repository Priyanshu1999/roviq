'use client';

import type { EmploymentType } from '@roviq/graphql/generated';
import { useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  Checkbox,
  DataTable,
  DataTableToolbar,
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
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
  SearchX,
  Star,
  UserCog,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { type StaffListFilter, type StaffListNode, useStaff } from './use-staff';

/**
 * Employment types mirror the server's `staff_profiles.employment_type` enum.
 * Documented centrally here so the filter dropdown, the CSV export, and the
 * cell-level label resolver all pick from the same source of truth.
 */
const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'VISITING', 'INTERN'] as const;

/** Page-size options for the pagination footer — matches students list. */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

const filterParsers = {
  search: parseAsString,
  department: parseAsString,
  designation: parseAsString,
  employmentType: parseAsString,
  isClassTeacher: parseAsBoolean,
  size: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
};

export default function StaffPage() {
  const t = useTranslations('staff');
  const resolveI18n = useI18nField();
  const router = useRouter();
  const [filters, setFilters] = useQueryStates(filterParsers);
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  // [JQGQM] — 150ms debounce for snappy typing.
  const debouncedSearch = useDebounce(searchInput, 150);

  React.useEffect(() => {
    setFilters({ search: debouncedSearch || null });
  }, [debouncedSearch, setFilters]);

  const queryFilter = React.useMemo<StaffListFilter>(() => {
    const f: StaffListFilter = { first: filters.size };
    if (filters.search) f.search = filters.search;
    if (filters.department) f.department = filters.department;
    if (filters.designation) f.designation = filters.designation;
    if (filters.employmentType) f.employmentType = filters.employmentType as EmploymentType;
    if (typeof filters.isClassTeacher === 'boolean') f.isClassTeacher = filters.isClassTeacher;
    return f;
  }, [filters]);

  const { staff, loading } = useStaff(queryFilter);

  // Extract the list of distinct departments and designations from the
  // currently loaded page so the filter dropdowns always show at least the
  // values the user can see. A dedicated aggregation endpoint could replace
  // this later, but page-scoped distinct values are a zero-cost default.
  const departmentOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of staff) {
      if (s.department) set.add(s.department);
    }
    return Array.from(set).sort();
  }, [staff]);

  const designationOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of staff) {
      if (s.designation) set.add(s.designation);
    }
    return Array.from(set).sort();
  }, [staff]);

  // ── Multi-select state for bulk actions ─────────────────────────────────
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

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
        for (const s of staff) {
          if (checked) next.add(s.id);
          else next.delete(s.id);
        }
        return next;
      });
    },
    [staff],
  );

  const allOnPageSelected = staff.length > 0 && staff.every((s) => selectedIds.has(s.id));

  const fullName = React.useCallback(
    (s: StaffListNode) =>
      [resolveI18n(s.firstName), s.lastName ? resolveI18n(s.lastName) : '']
        .filter(Boolean)
        .join(' '),
    [resolveI18n],
  );

  const columns = React.useMemo<ColumnDef<StaffListNode>[]>(
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
        accessorKey: 'employeeId',
        header: t('columns.employeeId'),
        cell: ({ row }) =>
          row.original.employeeId ? (
            <span className="font-mono text-xs text-muted-foreground">
              {row.original.employeeId}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">{t('columns.notSet')}</span>
          ),
      },
      {
        accessorKey: 'firstName',
        header: t('columns.name'),
        cell: ({ row }) => <span className="font-medium">{fullName(row.original)}</span>,
      },
      {
        accessorKey: 'designation',
        header: t('columns.designation'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.designation ?? (
              <span className="text-muted-foreground">{t('columns.notSet')}</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'department',
        header: t('columns.department'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.department ?? (
              <span className="text-muted-foreground">{t('columns.notSet')}</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: 'employmentType',
        header: t('columns.employmentType'),
        cell: ({ row }) => {
          const et = row.original.employmentType;
          if (!et) {
            return <span className="text-sm text-muted-foreground">{t('columns.notSet')}</span>;
          }
          return (
            <Badge variant="secondary" className="inline-flex items-center gap-1">
              <CheckCircle2 className="size-3.5" />
              {t(`employmentTypes.${et}`, { default: et })}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'isClassTeacher',
        header: t('columns.isClassTeacher'),
        cell: ({ row }) =>
          row.original.isClassTeacher ? (
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1 border-amber-300 text-amber-700"
            >
              <Star className="size-3.5" />
              {t('classTeacher.yes')}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">{t('classTeacher.no')}</span>
          ),
      },
    ],
    [t, fullName, allOnPageSelected, togglePage, toggleRow, selectedIds],
  );

  const hasFilters =
    filters.search !== null ||
    filters.department !== null ||
    filters.designation !== null ||
    filters.employmentType !== null ||
    filters.isClassTeacher !== null;

  const writeCsv = React.useCallback(
    (rows: StaffListNode[]) => {
      if (rows.length === 0) {
        toast.error(t('export.noRows'));
        return;
      }
      const header = [
        t('columns.employeeId'),
        t('columns.name'),
        t('columns.designation'),
        t('columns.department'),
        t('columns.employmentType'),
        t('columns.isClassTeacher'),
      ];
      const csvEscape = (value: string) => {
        if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
        return value;
      };
      const lines = [
        header.map(csvEscape).join(','),
        ...rows.map((s) =>
          [
            s.employeeId ?? '',
            fullName(s),
            s.designation ?? '',
            s.department ?? '',
            s.employmentType ?? '',
            s.isClassTeacher ? 'Yes' : 'No',
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
      a.download = `staff-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('export.success', { count: rows.length }));
    },
    [fullName, t],
  );

  const handleExportCsv = React.useCallback(() => {
    if (selectedIds.size > 0) {
      writeCsv(staff.filter((s) => selectedIds.has(s.id)));
      return;
    }
    writeCsv(staff);
  }, [selectedIds, staff, writeCsv]);

  const classTeacherValue =
    filters.isClassTeacher === true ? 'yes' : filters.isClassTeacher === false ? 'no' : '__all__';

  const handlePageSizeChange = React.useCallback(
    (value: string) => {
      setFilters({ size: Number.parseInt(value, 10) });
      setSelectedIds(new Set());
    },
    [setFilters],
  );

  return (
    <Can I="read" a="Staff" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-test-id="staff-title">
                  {t('title')}
                </h1>
                <p className="text-muted-foreground">{t('description')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleExportCsv}
                  className="min-h-11"
                  title={t('export.buttonAll')}
                >
                  <Download className="size-4" />
                  {selectedIds.size > 0
                    ? t('export.buttonSelected', { count: selectedIds.size })
                    : t('export.buttonAll')}
                </Button>
                <Can I="create" a="Staff">
                  <Button
                    className="min-h-11"
                    onClick={() => router.push('/institute/people/staff/new')}
                    title={t('addStaff')}
                    data-test-id="staff-new-btn"
                  >
                    <Plus className="size-4" />
                    {t('addStaff')}
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
                  data-test-id="staff-search"
                />
              </div>
              <Select
                value={filters.department ?? '__all__'}
                onValueChange={(v) => updateFilters({ department: v === '__all__' ? null : v })}
              >
                <SelectTrigger className="w-[180px]" aria-label={t('filters.department')}>
                  <SelectValue placeholder={t('filters.allDepartments')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.allDepartments')}</SelectItem>
                  {departmentOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.designation ?? '__all__'}
                onValueChange={(v) => updateFilters({ designation: v === '__all__' ? null : v })}
              >
                <SelectTrigger className="w-[180px]" aria-label={t('filters.designation')}>
                  <SelectValue placeholder={t('filters.allDesignations')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.allDesignations')}</SelectItem>
                  {designationOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.employmentType ?? '__all__'}
                onValueChange={(v) => updateFilters({ employmentType: v === '__all__' ? null : v })}
              >
                <SelectTrigger className="w-[170px]" aria-label={t('filters.employmentType')}>
                  <SelectValue placeholder={t('filters.allEmploymentTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.allEmploymentTypes')}</SelectItem>
                  {EMPLOYMENT_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>
                      {t(`employmentTypes.${et}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={classTeacherValue}
                onValueChange={(v) =>
                  updateFilters({
                    isClassTeacher: v === 'yes' ? true : v === 'no' ? false : null,
                  })
                }
              >
                <SelectTrigger className="w-[170px]" aria-label={t('filters.isClassTeacher')}>
                  <SelectValue placeholder={t('filters.classTeacherAny')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('filters.classTeacherAny')}</SelectItem>
                  <SelectItem value="yes">{t('filters.classTeacherYes')}</SelectItem>
                  <SelectItem value="no">{t('filters.classTeacherNo')}</SelectItem>
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
                      department: null,
                      designation: null,
                      employmentType: null,
                      isClassTeacher: null,
                    });
                  }}
                >
                  <X className="me-1 size-4" />
                  {t('filters.clear')}
                </Button>
              )}
            </DataTableToolbar>

            <DataTable
              data-test-id="staff-table"
              columns={columns}
              data={staff}
              isLoading={loading && staff.length === 0}
              skeletonRows={8}
              stickyFirstColumn
              onRowClick={(row) => router.push(`/institute/people/staff/${row.id}`)}
              emptyState={
                hasFilters ? (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchX />
                      </EmptyMedia>
                      <EmptyTitle data-test-id="staff-empty-state">{t('empty.noMatch')}</EmptyTitle>
                      <EmptyDescription>{t('empty.noMatchDescription')}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Briefcase />
                      </EmptyMedia>
                      <EmptyTitle>{t('empty.noData')}</EmptyTitle>
                      <EmptyDescription>{t('empty.noDataDescription')}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )
              }
            />

            <div className="flex items-center justify-between gap-4 px-2 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCog className="size-4" />
                <span>
                  {t('pagination.window', {
                    start: staff.length === 0 ? 0 : 1,
                    end: staff.length,
                    total: staff.length,
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t('pagination.rowsPerPage')}</span>
                  <Select value={String(filters.size)} onValueChange={handlePageSizeChange}>
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
                    disabled
                    title={t('pagination.prev')}
                    aria-label={t('pagination.prev')}
                    className="min-h-11 min-w-11"
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    title={t('pagination.next')}
                    aria-label={t('pagination.next')}
                    className="min-h-11 min-w-11"
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

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
                      <Button
                        variant="outline"
                        onClick={handleExportCsv}
                        className="min-h-11"
                        title={t('export.buttonSelected', { count: selectedIds.size })}
                      >
                        <Download className="size-4" />
                        {t('export.buttonSelected', { count: selectedIds.size })}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedIds(new Set())}
                        className="min-h-11"
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
