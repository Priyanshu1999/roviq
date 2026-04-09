'use client';

import {
  Badge,
  Button,
  Can,
  DataTable,
  DataTableToolbar,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useDebounce,
} from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import {
  Activity,
  BookOpen,
  Boxes,
  Bus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Drama,
  FlaskConical,
  Globe2,
  GraduationCap,
  Group as GroupIcon,
  HeartHandshake,
  Home,
  Layers,
  Library,
  LucideUsers,
  Plus,
  Search,
  SearchX,
  Settings2,
  Shield,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsArrayOf, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';
import { type GroupListFilter, type GroupNode, useGroups } from './use-groups';

/**
 * 16 ROV-170 group types — each has a distinct color + icon so clerks can
 * scan a long list at a glance. Keep this list in sync with the backend
 * `groupType` enum allow-list.
 */
const GROUP_TYPES = [
  'class',
  'section',
  'house',
  'club',
  'committee',
  'sports_team',
  'transport_route',
  'hostel',
  'department',
  'subject_group',
  'elective_group',
  'project_team',
  'alumni_cohort',
  'composite',
  'custom',
  'system',
] as const;

const GROUP_TYPE_CLASS: Record<string, string> = {
  class: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  section: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  house: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  club: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  committee: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  sports_team: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  transport_route: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  hostel: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  department: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  subject_group: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  elective_group: 'bg-lime-100 text-lime-700 dark:bg-lime-900 dark:text-lime-300',
  project_team: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900 dark:text-fuchsia-300',
  alumni_cohort: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  composite: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  custom: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  system: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const GROUP_TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  class: GraduationCap,
  section: BookOpen,
  house: Home,
  club: Drama,
  committee: Shield,
  sports_team: Trophy,
  transport_route: Bus,
  hostel: Library,
  department: Layers,
  subject_group: FlaskConical,
  elective_group: Target,
  project_team: Sparkles,
  alumni_cohort: HeartHandshake,
  composite: Boxes,
  custom: Settings2,
  system: Globe2,
};

const MEMBERSHIP_TYPES = ['static', 'dynamic', 'hybrid'] as const;

const MEMBERSHIP_TYPE_CLASS: Record<string, string> = {
  static: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  dynamic: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  hybrid: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

const MEMBERSHIP_TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  static: LucideUsers,
  dynamic: Zap,
  hybrid: Shuffle,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

const filterParsers = {
  search: parseAsString,
  type: parseAsArrayOf(parseAsString),
  membershipType: parseAsArrayOf(parseAsString),
  size: parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
};

/** Format ISO date to DD/MM/YYYY per frontend-ux [GYATP]. */
function formatDdMmYyyy(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function GroupsListPage() {
  const t = useTranslations('groups');
  const router = useRouter();
  const [filters, setFilters] = useQueryStates(filterParsers);
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 250);
  const [pageIndex, setPageIndex] = React.useState(0);

  React.useEffect(() => {
    setFilters({ search: debouncedSearch || null });
    setPageIndex(0);
  }, [debouncedSearch, setFilters]);

  // Backend supports single-value filters — send the first selected entry
  // (if any). Additional multi-select filtering is applied client-side.
  const queryFilter = React.useMemo<GroupListFilter>(() => {
    const f: GroupListFilter = {};
    if (filters.search) f.search = filters.search;
    if (filters.type && filters.type.length > 0) f.groupType = filters.type[0];
    if (filters.membershipType && filters.membershipType.length > 0) {
      f.membershipType = filters.membershipType[0];
    }
    return f;
  }, [filters.search, filters.type, filters.membershipType]);

  const { groups, loading } = useGroups(queryFilter);

  // Client-side multi-select refinement for type and membershipType.
  const filteredGroups = React.useMemo(() => {
    let list = groups;
    if (filters.type && filters.type.length > 1) {
      const set = new Set(filters.type);
      list = list.filter((g) => set.has(g.groupType));
    }
    if (filters.membershipType && filters.membershipType.length > 1) {
      const set = new Set(filters.membershipType);
      list = list.filter((g) => set.has(g.membershipType));
    }
    return list;
  }, [groups, filters.type, filters.membershipType]);

  const pagedGroups = React.useMemo(() => {
    const start = pageIndex * filters.size;
    return filteredGroups.slice(start, start + filters.size);
  }, [filteredGroups, pageIndex, filters.size]);

  const totalCount = filteredGroups.length;
  const hasNextPage = (pageIndex + 1) * filters.size < totalCount;

  const columns = React.useMemo<ColumnDef<GroupNode>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('columns.name'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: 'groupType',
        header: t('columns.type'),
        cell: ({ row }) => {
          const gt = row.original.groupType;
          const Icon = GROUP_TYPE_ICON[gt] ?? Settings2;
          return (
            <Badge
              variant="secondary"
              className={`inline-flex items-center gap-1 ${GROUP_TYPE_CLASS[gt] ?? ''}`}
            >
              <Icon className="size-3.5" />
              {t(`types.${gt}`, { default: gt })}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'membershipType',
        header: t('columns.membershipType'),
        cell: ({ row }) => {
          const mt = row.original.membershipType;
          const Icon = MEMBERSHIP_TYPE_ICON[mt] ?? LucideUsers;
          return (
            <Badge
              variant="secondary"
              className={`inline-flex items-center gap-1 ${MEMBERSHIP_TYPE_CLASS[mt] ?? ''}`}
            >
              <Icon className="size-3.5" />
              {t(`membershipTypes.${mt}`, { default: mt })}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'memberCount',
        header: t('columns.memberCount'),
        cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.memberCount}</span>,
      },
      {
        accessorKey: 'resolvedAt',
        header: t('columns.lastResolved'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDdMmYyyy(row.original.resolvedAt)}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: t('columns.created'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDdMmYyyy(row.original.createdAt)}
          </span>
        ),
      },
    ],
    [t],
  );

  const hasFilters = Boolean(
    filters.search ||
      (filters.type && filters.type.length > 0) ||
      (filters.membershipType && filters.membershipType.length > 0),
  );

  return (
    <Can I="read" a="Group" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between print:hidden">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
                <p className="text-muted-foreground">{t('description')}</p>
              </div>
              <Can I="create" a="Group">
                <Button onClick={() => router.push('/institute/groups/new')}>
                  <Plus className="size-4" />
                  {t('actions.create')}
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
                  <Button variant="outline" className="w-[200px] justify-between">
                    <span className="truncate">
                      {filters.type && filters.type.length > 0
                        ? t('filters.typesSelected', { count: filters.type.length })
                        : t('filters.allTypes')}
                    </span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {GROUP_TYPES.map((gt) => {
                      const selected = filters.type?.includes(gt) ?? false;
                      const toggle = () => {
                        const current = filters.type ?? [];
                        const next = selected ? current.filter((x) => x !== gt) : [...current, gt];
                        setFilters({ type: next.length > 0 ? next : null });
                        setPageIndex(0);
                      };
                      const Icon = GROUP_TYPE_ICON[gt] ?? Settings2;
                      return (
                        <button
                          type="button"
                          key={gt}
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
                          <span>{t(`types.${gt}`, { default: gt })}</span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-between">
                    <span className="truncate">
                      {filters.membershipType && filters.membershipType.length > 0
                        ? t('filters.membershipSelected', {
                            count: filters.membershipType.length,
                          })
                        : t('filters.allMembershipTypes')}
                    </span>
                    <ChevronDown className="size-4 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-60 p-2" align="start">
                  <div className="space-y-1">
                    {MEMBERSHIP_TYPES.map((mt) => {
                      const selected = filters.membershipType?.includes(mt) ?? false;
                      const toggle = () => {
                        const current = filters.membershipType ?? [];
                        const next = selected ? current.filter((x) => x !== mt) : [...current, mt];
                        setFilters({
                          membershipType: next.length > 0 ? next : null,
                        });
                        setPageIndex(0);
                      };
                      const Icon = MEMBERSHIP_TYPE_ICON[mt] ?? LucideUsers;
                      return (
                        <button
                          type="button"
                          key={mt}
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
                          <span>{t(`membershipTypes.${mt}`, { default: mt })}</span>
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
                    setFilters({ search: null, type: null, membershipType: null });
                    setPageIndex(0);
                  }}
                >
                  {t('filters.clear')}
                </Button>
              )}
            </DataTableToolbar>

            <DataTable
              columns={columns}
              data={pagedGroups}
              isLoading={loading && groups.length === 0}
              stickyFirstColumn
              skeletonRows={8}
              onRowClick={(row) => router.push(`/institute/groups/${row.id}`)}
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
                        <GroupIcon />
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
              currentCount={pagedGroups.length}
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
          </div>
        ) : null
      }
    </Can>
  );
}

// ─── Windowed Pagination (mirrors students/certificates pattern) ───────────

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
  const t = useTranslations('groups');
  const start = currentCount === 0 ? 0 : pageIndex * pageSize + 1;
  const end = pageIndex * pageSize + currentCount;
  const canGoPrev = pageIndex > 0 && !loading;
  const canGoNext = hasNextPage && !loading;

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-4 print:hidden">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Activity className="size-3.5" aria-hidden />
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
