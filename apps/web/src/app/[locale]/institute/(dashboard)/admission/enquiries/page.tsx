'use client';

import { useFormatDate } from '@roviq/i18n';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowRightCircle, Inbox, LayoutGrid, List, Plus, Search, SearchX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import {
  ENQUIRY_SOURCE_VALUES,
  ENQUIRY_STATUS_CLASS,
  ENQUIRY_STATUS_ICON,
  ENQUIRY_STATUS_VALUES,
  type EnquiryStatusKey,
} from '../admission-constants';
import {
  type EnquiryFilter,
  type EnquiryNode,
  useEnquiries,
  useEnquiryCreated,
} from '../use-admission';
import { ConvertEnquiryDialog } from './convert-enquiry-dialog';
import { EnquiriesKanban } from './enquiries-kanban';
import { EnquiryFormSheet } from './enquiry-form-sheet';

const { instituteAdmissionEnquiries } = testIds;
type ViewMode = 'table' | 'kanban';

const filterParsers = {
  search: parseAsString,
  status: parseAsString,
  source: parseAsString,
  classRequested: parseAsString,
  followUpFrom: parseAsString,
  followUpTo: parseAsString,
  view: parseAsStringEnum<ViewMode>(['table', 'kanban']).withDefault('table'),
};

export default function EnquiriesPage() {
  const t = useTranslations('admission');
  const { format, formatDistance } = useFormatDate();

  const [filters, setFilters] = useQueryStates(filterParsers);
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [convertEnquiry, setConvertEnquiry] = React.useState<EnquiryNode | null>(null);

  // Debounce search separately from the URL state to avoid spamming nuqs.
  React.useEffect(() => {
    const id = setTimeout(() => {
      setFilters({ search: searchInput || null });
    }, 250);
    return () => clearTimeout(id);
  }, [searchInput, setFilters]);

  const queryFilter = React.useMemo<EnquiryFilter>(() => {
    const f: EnquiryFilter = { first: 100 };
    if (filters.search) f.search = filters.search;
    if (filters.status) f.status = filters.status as EnquiryStatusKey;
    if (filters.source) f.source = filters.source as (typeof ENQUIRY_SOURCE_VALUES)[number];
    if (filters.classRequested) f.classRequested = filters.classRequested;
    if (filters.followUpFrom) f.followUpFrom = filters.followUpFrom;
    if (filters.followUpTo) f.followUpTo = filters.followUpTo;
    return f;
  }, [filters]);

  const { enquiries, totalCount, loading, refetch } = useEnquiries(queryFilter);

  // ROV-168 spec: real-time `enquiryCreated` subscription should make new
  // rows appear live. We refetch on every event so the new row + filtered
  // list reconcile correctly without manual cache merges.
  useEnquiryCreated((node) => {
    toast.info(t('enquiries.newEventToast', { name: node.studentName }));
    refetch();
  });

  const hasFilters =
    !!filters.search ||
    !!filters.status ||
    !!filters.source ||
    !!filters.classRequested ||
    !!filters.followUpFrom ||
    !!filters.followUpTo;

  const clearFilters = () => {
    setSearchInput('');
    setFilters({
      search: null,
      status: null,
      source: null,
      classRequested: null,
      followUpFrom: null,
      followUpTo: null,
    });
  };

  // ─── Columns for the table view ─────────────────────────────────────────
  const columns = React.useMemo<ColumnDef<EnquiryNode>[]>(
    () => [
      {
        accessorKey: 'studentName',
        header: t('enquiries.columns.studentName'),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.studentName}</p>
            <p className="text-xs text-muted-foreground">
              {row.original.classRequested}
              {row.original.gender ? ` · ${t(`genders.${row.original.gender}`)}` : ''}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'parentName',
        header: t('enquiries.columns.parent'),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm">{row.original.parentName}</p>
            <p className="text-xs text-muted-foreground">+91 {row.original.parentPhone}</p>
          </div>
        ),
      },
      {
        accessorKey: 'classRequested',
        header: t('enquiries.columns.classRequested'),
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.classRequested}</span>
        ),
      },
      {
        accessorKey: 'source',
        header: t('enquiries.columns.source'),
        cell: ({ row }) => (
          <Badge variant="outline" data-testid={`enquiry-source-${row.original.id}`}>
            {t(`sources.${row.original.source}`, { default: row.original.source })}
          </Badge>
        ),
      },
      {
        accessorKey: 'status',
        header: t('enquiries.columns.status'),
        cell: ({ row }) => {
          const key = row.original.status as EnquiryStatusKey;
          const Icon = ENQUIRY_STATUS_ICON[key] ?? ENQUIRY_STATUS_ICON.NEW;
          return (
            <Badge
              variant="secondary"
              data-testid={`enquiry-status-${row.original.id}`}
              className={`inline-flex items-center gap-1 ${ENQUIRY_STATUS_CLASS[key] ?? ''}`}
            >
              <Icon className="size-3.5" />
              {t(`enquiryStatuses.${key}`, { default: row.original.status })}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'followUpDate',
        header: t('enquiries.columns.followUpDate'),
        cell: ({ row }) => {
          const raw = row.original.followUpDate;
          if (!raw) return <span className="text-xs text-muted-foreground">—</span>;
          const date = new Date(raw);
          const isOverdue = date.getTime() < Date.now();
          return (
            <span
              data-testid={`enquiry-followup-${row.original.id}`}
              className={
                isOverdue
                  ? 'inline-flex items-center gap-1 text-sm font-medium text-rose-700 dark:text-rose-400'
                  : 'text-sm text-muted-foreground'
              }
            >
              {isOverdue && (
                <span role="img" aria-label={t('enquiries.followUp.overdue')}>
                  ⚠
                </span>
              )}
              {format(date, 'dd MMM yyyy')}
            </span>
          );
        },
      },
      {
        accessorKey: 'assignedTo',
        header: t('enquiries.columns.assignedTo'),
        cell: ({ row }) =>
          row.original.assignedTo ? (
            // Backend returns a UUID; we don't currently resolve it to a
            // staff name in the list response. Surfacing the short form keeps
            // it useful for assignment audit; full name resolution lives on
            // the detail view (TODO once a staff lookup query exists).
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {row.original.assignedTo.slice(0, 8)}
            </code>
          ) : (
            <span className="text-xs text-muted-foreground">{t('enquiries.unassigned')}</span>
          ),
      },
      {
        accessorKey: 'createdAt',
        header: t('enquiries.columns.createdAt'),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDistance(new Date(row.original.createdAt), new Date())}
          </span>
        ),
      },
      {
        id: 'actions',
        header: t('enquiries.columns.actions'),
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Can I="create" a="Application">
              <Button
                size="sm"
                variant="outline"
                title={t('enquiries.actions.convert')}
                data-testid={`enquiry-convert-btn-${row.original.id}`}
                disabled={!!row.original.convertedToApplicationId}
                onClick={(e) => {
                  e.stopPropagation();
                  setConvertEnquiry(row.original);
                }}
              >
                <ArrowRightCircle aria-hidden="true" className="size-4" />
                <span className="sr-only md:not-sr-only md:ms-1">
                  {t('enquiries.actions.convert')}
                </span>
              </Button>
            </Can>
          </div>
        ),
      },
    ],
    [t, format, formatDistance],
  );

  return (
    <Can I="read" a="Enquiry" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-4">
            {/* Page header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1
                  className="text-2xl font-bold tracking-tight"
                  data-testid={instituteAdmissionEnquiries.title}
                >
                  {t('enquiries.title')}
                </h1>
                <p className="text-muted-foreground">{t('enquiries.description')}</p>
              </div>
              <div className="flex items-center gap-2">
                <ViewModeToggle value={filters.view} onChange={(v) => setFilters({ view: v })} />
                <Can I="create" a="Enquiry">
                  <Button
                    onClick={() => setCreateOpen(true)}
                    data-testid={instituteAdmissionEnquiries.newBtn}
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    {t('enquiries.actions.newEnquiry')}
                  </Button>
                </Can>
              </div>
            </div>

            {/* Filter toolbar */}
            <EnquiriesFilterToolbar
              searchInput={searchInput}
              setSearchInput={setSearchInput}
              status={filters.status}
              source={filters.source}
              classRequested={filters.classRequested}
              followUpFrom={filters.followUpFrom}
              followUpTo={filters.followUpTo}
              onChange={(patch) => setFilters(patch)}
              hasFilters={hasFilters}
              onClear={clearFilters}
            />

            {/* Body — table or kanban */}
            {filters.view === 'kanban' ? (
              <EnquiriesKanban enquiries={enquiries} />
            ) : (
              <>
                <DataTable
                  data-testid={instituteAdmissionEnquiries.table}
                  columns={columns}
                  data={enquiries}
                  isLoading={loading && enquiries.length === 0}
                  emptyState={
                    hasFilters ? (
                      <Empty className="py-12">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <SearchX aria-hidden="true" />
                          </EmptyMedia>
                          <EmptyTitle data-testid={instituteAdmissionEnquiries.emptyNoMatch}>
                            {t('enquiries.empty.noMatch')}
                          </EmptyTitle>
                          <EmptyDescription>
                            {t('enquiries.empty.noMatchDescription')}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    ) : (
                      <Empty className="py-12">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Inbox aria-hidden="true" />
                          </EmptyMedia>
                          <EmptyTitle data-testid={instituteAdmissionEnquiries.emptyNoData}>
                            {t('enquiries.empty.noData')}
                          </EmptyTitle>
                          <EmptyDescription>
                            {t('enquiries.empty.noDataDescription')}
                          </EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )
                  }
                />
                <p
                  className="px-2 pb-2 text-xs text-muted-foreground"
                  data-testid={instituteAdmissionEnquiries.total}
                >
                  {totalCount}{' '}
                  {totalCount === 1 ? t('enquiries.columns.studentName') : t('enquiries.title')}
                </p>
              </>
            )}

            {/* Modals */}
            <EnquiryFormSheet
              open={createOpen}
              onOpenChange={setCreateOpen}
              onCreated={() => refetch()}
            />
            <ConvertEnquiryDialog
              open={!!convertEnquiry}
              onOpenChange={(o) => !o && setConvertEnquiry(null)}
              enquiryId={convertEnquiry?.id ?? null}
              enquiryLabel={convertEnquiry?.studentName}
            />
          </div>
        ) : (
          <div className="flex min-h-[400px] items-center justify-center">
            <p className="text-muted-foreground">{t('accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const t = useTranslations('admission');
  return (
    <div className="inline-flex rounded-md border bg-background p-0.5" role="tablist">
      <Button
        type="button"
        role="tab"
        aria-selected={value === 'table'}
        size="sm"
        variant={value === 'table' ? 'secondary' : 'ghost'}
        onClick={() => onChange('table')}
        data-testid={instituteAdmissionEnquiries.viewTableBtn}
        title={t('enquiries.viewMode.table')}
      >
        <List aria-hidden="true" className="size-4" />
        <span className="ms-1 hidden sm:inline">{t('enquiries.viewMode.table')}</span>
      </Button>
      <Button
        type="button"
        role="tab"
        aria-selected={value === 'kanban'}
        size="sm"
        variant={value === 'kanban' ? 'secondary' : 'ghost'}
        onClick={() => onChange('kanban')}
        data-testid={instituteAdmissionEnquiries.viewKanbanBtn}
        title={t('enquiries.viewMode.kanban')}
      >
        <LayoutGrid aria-hidden="true" className="size-4" />
        <span className="ms-1 hidden sm:inline">{t('enquiries.viewMode.kanban')}</span>
      </Button>
    </div>
  );
}

interface EnquiriesFilterToolbarProps {
  searchInput: string;
  setSearchInput: (value: string) => void;
  status: string | null;
  source: string | null;
  classRequested: string | null;
  followUpFrom: string | null;
  followUpTo: string | null;
  onChange: (patch: Record<string, string | null>) => void;
  hasFilters: boolean;
  onClear: () => void;
}

function EnquiriesFilterToolbar({
  searchInput,
  setSearchInput,
  status,
  source,
  classRequested,
  followUpFrom,
  followUpTo,
  onChange,
  hasFilters,
  onClear,
}: EnquiriesFilterToolbarProps) {
  const t = useTranslations('admission');
  return (
    <DataTableToolbar>
      <div className="relative flex-1 min-w-[200px]">
        <Search
          aria-hidden="true"
          className="absolute start-2.5 top-2 size-4 text-muted-foreground"
        />
        <Input
          data-testid={instituteAdmissionEnquiries.searchInput}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('enquiries.filters.search')}
          className="ps-8"
        />
      </div>

      <Select
        value={status ?? '__all__'}
        onValueChange={(v) => onChange({ status: v === '__all__' ? null : v })}
      >
        <SelectTrigger
          className="w-[160px]"
          aria-label={t('enquiries.filters.allStatuses')}
          data-testid={instituteAdmissionEnquiries.statusFilter}
        >
          <SelectValue placeholder={t('enquiries.filters.allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('enquiries.filters.allStatuses')}</SelectItem>
          {ENQUIRY_STATUS_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`enquiryStatuses.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={source ?? '__all__'}
        onValueChange={(v) => onChange({ source: v === '__all__' ? null : v })}
      >
        <SelectTrigger
          className="w-[150px]"
          aria-label={t('enquiries.filters.allSources')}
          data-testid={instituteAdmissionEnquiries.sourceFilter}
        >
          <SelectValue placeholder={t('enquiries.filters.allSources')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('enquiries.filters.allSources')}</SelectItem>
          {ENQUIRY_SOURCE_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`sources.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        className="w-[140px]"
        placeholder={t('enquiries.filters.classRequestedPlaceholder')}
        value={classRequested ?? ''}
        onChange={(e) => onChange({ classRequested: e.target.value || null })}
        data-testid={instituteAdmissionEnquiries.classFilter}
        aria-label={t('enquiries.filters.allClasses')}
      />

      <div className="flex items-center gap-1">
        <Input
          type="date"
          aria-label={t('enquiries.filters.followUpFrom')}
          className="w-[140px]"
          value={followUpFrom ?? ''}
          onChange={(e) => onChange({ followUpFrom: e.target.value || null })}
          data-testid={instituteAdmissionEnquiries.followupFrom}
        />
        <Input
          type="date"
          aria-label={t('enquiries.filters.followUpTo')}
          className="w-[140px]"
          value={followUpTo ?? ''}
          onChange={(e) => onChange({ followUpTo: e.target.value || null })}
          data-testid={instituteAdmissionEnquiries.followupTo}
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          data-testid={instituteAdmissionEnquiries.clearFiltersBtn}
          onClick={onClear}
        >
          <X aria-hidden="true" className="me-1 size-4" />
          {t('enquiries.filters.clear')}
        </Button>
      )}
    </DataTableToolbar>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
