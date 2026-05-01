'use client';

import { INSTITUTE_STATUS_VALUES, INSTITUTE_TYPE_VALUES } from '@roviq/common-types';
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
import { testIds } from '@roviq/ui/testing/testid-registry';
import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsIsoDate, parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';
import { InstituteGroupCombobox } from './_components/institute-group-combobox';
import { ResellerCombobox } from './_components/reseller-combobox';

const filterParsers = {
  search: parseAsString,
  status: parseAsString,
  type: parseAsString,
  board: parseAsString,
  state: parseAsString,
  district: parseAsString,
  resellerId: parseAsString,
  groupId: parseAsString,
  createdAfter: parseAsIsoDate,
  createdBefore: parseAsIsoDate,
};

export function useInstituteFilters() {
  return useQueryStates(filterParsers);
}
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

      <Select
        value={filters.status ?? '__all__'}
        onValueChange={(v) => setFilters({ status: v === '__all__' ? null : v })}
      >
        <SelectTrigger className="w-[160px]" aria-label={t('filters.allStatuses')}>
          <SelectValue placeholder={t('filters.allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allStatuses')}</SelectItem>
          {INSTITUTE_STATUS_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`statuses.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.type ?? '__all__'}
        onValueChange={(v) => setFilters({ type: v === '__all__' ? null : v })}
      >
        <SelectTrigger className="w-[140px]" aria-label={t('filters.allTypes')}>
          <SelectValue placeholder={t('filters.allTypes')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allTypes')}</SelectItem>
          {INSTITUTE_TYPE_VALUES.map((tp) => (
            <SelectItem key={tp} value={tp}>
              {t(`types.${tp}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.board ?? '__all__'}
        onValueChange={(v) => setFilters({ board: v === '__all__' ? null : v })}
      >
        <SelectTrigger className="w-[130px]" aria-label={t('filters.allBoards')}>
          <SelectValue placeholder={t('filters.allBoards')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allBoards')}</SelectItem>
          {BOARDS.map((b) => (
            <SelectItem key={b} value={b}>
              {b.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-[180px]">
        <ResellerCombobox
          value={filters.resellerId}
          onChange={(v) => setFilters({ resellerId: v })}
          placeholder={t('filters.allResellers')}
          data-testid={testIds.adminInstitutes.filterReseller}
        />
      </div>

      <div className="w-[180px]">
        <InstituteGroupCombobox
          value={filters.groupId}
          onChange={(v) => setFilters({ groupId: v })}
          placeholder={t('filters.allGroups')}
          data-testid={testIds.adminInstitutes.filterGroup}
        />
      </div>

      <Input
        value={filters.state ?? ''}
        onChange={(e) => setFilters({ state: e.target.value || null })}
        placeholder={t('filters.state')}
        className="w-[140px]"
        aria-label={t('filters.state')}
      />

      <Input
        value={filters.district ?? ''}
        onChange={(e) => setFilters({ district: e.target.value || null })}
        placeholder={t('filters.district')}
        className="w-[140px]"
        aria-label={t('filters.district')}
      />

      <Input
        type="date"
        value={filters.createdAfter ? filters.createdAfter.toISOString().slice(0, 10) : ''}
        onChange={(e) =>
          setFilters({ createdAfter: e.target.value ? new Date(e.target.value) : null })
        }
        className="w-[150px]"
        aria-label={t('filters.createdAfter')}
        title={t('filters.createdAfter')}
      />
      <Input
        type="date"
        value={filters.createdBefore ? filters.createdBefore.toISOString().slice(0, 10) : ''}
        onChange={(e) =>
          setFilters({ createdBefore: e.target.value ? new Date(e.target.value) : null })
        }
        className="w-[150px]"
        aria-label={t('filters.createdBefore')}
        title={t('filters.createdBefore')}
      />

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
              resellerId: null,
              groupId: null,
              createdAfter: null,
              createdBefore: null,
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
