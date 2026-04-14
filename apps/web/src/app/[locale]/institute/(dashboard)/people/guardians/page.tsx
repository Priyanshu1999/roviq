'use client';

import { useFormatNumber, useI18nField, useRouter } from '@roviq/i18n';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
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
  useDebounce,
} from '@roviq/ui';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, SearchX, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';
import { type GuardianListNode, useGuardians } from './use-guardians';

const filterParsers = {
  search: parseAsString,
};

/**
 * Guardian list page (ROV-169).
 *
 * Mirrors the students list pattern: nuqs URL state → Apollo → DataTable.
 * Guardians are a small list per institute (typically < 1000), so we skip
 * cursor pagination and render the full set in one shot with a 200-row
 * server-side cap. Free-text search runs over the joined
 * user_profiles.search_vector on the server (plainto_tsquery).
 */
export default function GuardiansPage() {
  const t = useTranslations('guardians');
  const tCommon = useTranslations('common');
  const resolveI18n = useI18nField();
  const { format: formatNumber } = useFormatNumber();
  const router = useRouter();
  const [filters, setFilters] = useQueryStates(filterParsers);
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  // [JQGQM] — 150ms debounce for snappy search feel.
  const debouncedSearch = useDebounce(searchInput, 150);

  React.useEffect(() => {
    setFilters({ search: debouncedSearch || null });
  }, [debouncedSearch, setFilters]);

  const queryFilter = React.useMemo(
    () => ({ search: filters.search ?? undefined }),
    [filters.search],
  );

  const { data, loading } = useGuardians(queryFilter);
  const guardians = React.useMemo(() => data?.listGuardians ?? [], [data]);

  const fullName = React.useCallback(
    (g: GuardianListNode) =>
      [resolveI18n(g.firstName), resolveI18n(g.lastName)].filter(Boolean).join(' '),
    [resolveI18n],
  );

  const initials = React.useCallback(
    (g: GuardianListNode) => {
      const name = fullName(g);
      if (!name) return '?';
      return name
        .split(' ')
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
    },
    [fullName],
  );

  const columns = React.useMemo<ColumnDef<GuardianListNode>[]>(
    () => [
      {
        id: 'photo',
        header: t('columns.photo'),
        cell: ({ row }) => (
          <Avatar className="size-8">
            {row.original.profileImageUrl ? (
              <AvatarImage src={row.original.profileImageUrl} alt={fullName(row.original)} />
            ) : null}
            <AvatarFallback>{initials(row.original)}</AvatarFallback>
          </Avatar>
        ),
        size: 56,
      },
      {
        accessorKey: 'firstName',
        header: t('columns.name'),
        cell: ({ row }) => (
          <div className="font-medium">{fullName(row.original) || t('notSet')}</div>
        ),
      },
      {
        accessorKey: 'primaryPhone',
        header: t('columns.phone'),
        cell: ({ row }) =>
          row.original.primaryPhone ? (
            <span className="font-mono text-sm tabular-nums">{row.original.primaryPhone}</span>
          ) : (
            <span className="text-sm text-muted-foreground">{t('notSet')}</span>
          ),
      },
      {
        accessorKey: 'linkedStudentCount',
        header: t('columns.linkedStudents'),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatNumber(row.original.linkedStudentCount)}
          </span>
        ),
      },
      {
        accessorKey: 'occupation',
        header: t('columns.occupation'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.occupation ?? t('notSet')}
          </span>
        ),
      },
      {
        accessorKey: 'organization',
        header: t('columns.organization'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.organization ?? t('notSet')}
          </span>
        ),
      },
      {
        accessorKey: 'designation',
        header: t('columns.designation'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.designation ?? t('notSet')}
          </span>
        ),
      },
      {
        accessorKey: 'educationLevel',
        header: t('columns.educationLevel'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.educationLevel
              ? t(`educationLevels.${row.original.educationLevel}`, {
                  default: row.original.educationLevel,
                })
              : t('notSet')}
          </span>
        ),
      },
    ],
    [t, fullName, initials, formatNumber],
  );

  const hasFilters = Boolean(filters.search);

  return (
    <Can I="read" a="Guardian" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="guardians-title">
                  {t('title')}
                </h1>
                <p className="text-muted-foreground">{t('description')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Can I="create" a="Guardian">
                  <Button onClick={() => router.push('/people/guardians/new')}>
                    <Plus className="size-4" />
                    {t('addGuardian')}
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
                  placeholder={t('filters.searchByNameOrPhone')}
                  className="ps-8"
                  aria-label={t('filters.searchByNameOrPhone')}
                  data-testid="guardians-search-input"
                />
              </div>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setFilters({ search: null });
                  }}
                >
                  <X className="me-1 size-4" />
                  {tCommon('clear')}
                </Button>
              )}
            </DataTableToolbar>

            <DataTable
              columns={columns}
              data={guardians}
              isLoading={loading && guardians.length === 0}
              stickyFirstColumn={true}
              skeletonRows={8}
              onRowClick={(row) => router.push(`/people/guardians/${row.id}`)}
              emptyState={
                hasFilters ? (
                  <Empty className="py-12" data-testid="guardians-filtered-empty">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <SearchX />
                      </EmptyMedia>
                      <EmptyTitle>{t('empty.filteredTitle')}</EmptyTitle>
                      <EmptyDescription>{t('empty.filteredDescription')}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Empty className="py-12">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Users />
                      </EmptyMedia>
                      <EmptyTitle>{t('empty.title')}</EmptyTitle>
                      <EmptyDescription>{t('empty.description')}</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )
              }
            />

            <p className="text-xs text-muted-foreground text-end">
              {t('totalCount', { count: guardians.length })}
            </p>
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
