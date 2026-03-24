'use client';

import {
  Button,
  DataTableToolbar,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useDebounce,
} from '@roviq/ui';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';

const filterParsers = {
  search: parseAsString,
  status: parseAsString,
  type: parseAsString,
  board: parseAsString,
  state: parseAsString,
  district: parseAsString,
};

export function useInstituteFilters() {
  return useQueryStates(filterParsers);
}

const STATUSES = [
  'PENDING_APPROVAL',
  'PENDING',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'REJECTED',
] as const;

const TYPES = ['SCHOOL', 'COACHING', 'LIBRARY'] as const;
const BOARDS = ['cbse', 'bseh', 'rbse', 'icse'] as const;

export function InstituteFilters() {
  const t = useTranslations('adminInstitutes');
  const [filters, setFilters] = useInstituteFilters();
  const [searchInput, setSearchInput] = React.useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  React.useEffect(() => {
    setFilters({ search: debouncedSearch || null });
  }, [debouncedSearch, setFilters]);

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <DataTableToolbar>
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2 size-4 text-muted-foreground" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('filters.search')}
          className="pl-8"
        />
      </div>

      <Select value={filters.status ?? ''} onValueChange={(v) => setFilters({ status: v || null })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder={t('filters.allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t('filters.allStatuses')}</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`statuses.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.type ?? ''} onValueChange={(v) => setFilters({ type: v || null })}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder={t('filters.allTypes')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t('filters.allTypes')}</SelectItem>
          {TYPES.map((tp) => (
            <SelectItem key={tp} value={tp}>
              {t(`types.${tp}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.board ?? ''} onValueChange={(v) => setFilters({ board: v || null })}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder={t('filters.allBoards')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">{t('filters.allBoards')}</SelectItem>
          {BOARDS.map((b) => (
            <SelectItem key={b} value={b}>
              {b.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setFilters({
              search: null,
              status: null,
              type: null,
              board: null,
              state: null,
              district: null,
            })
          }
        >
          <X className="me-1 size-4" />
          {t('filters.clearFilters')}
        </Button>
      )}
    </DataTableToolbar>
  );
}
