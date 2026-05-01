'use client';

import { RESELLER_STATUS_VALUES, RESELLER_TIER_VALUES } from '@roviq/common-types';
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

const { adminResellers } = testIds;
const filterParsers = {
  search: parseAsString,
  status: parseAsString,
  tier: parseAsString,
};

export function useResellerFilters() {
  return useQueryStates(filterParsers);
}

export function ResellerFilters() {
  const t = useTranslations('adminResellers');
  const [filters, setFilters] = useResellerFilters();
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
          data-testid={adminResellers.searchInput}
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
        <SelectTrigger
          className="w-[160px]"
          aria-label={t('filters.allStatuses')}
          data-testid={adminResellers.statusFilter}
        >
          <SelectValue placeholder={t('filters.allStatuses')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allStatuses')}</SelectItem>
          {RESELLER_STATUS_VALUES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`statuses.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.tier ?? '__all__'}
        onValueChange={(v) => setFilters({ tier: v === '__all__' ? null : v })}
      >
        <SelectTrigger
          className="w-[180px]"
          aria-label={t('filters.allTiers')}
          data-testid={adminResellers.tierFilter}
        >
          <SelectValue placeholder={t('filters.allTiers')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{t('filters.allTiers')}</SelectItem>
          {RESELLER_TIER_VALUES.map((tier) => (
            <SelectItem key={tier} value={tier}>
              {t(`tiers.${tier}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          data-testid={adminResellers.clearFilters}
          onClick={() => setFilters({ search: null, status: null, tier: null })}
        >
          <X className="me-1 size-4" />
          {t('filters.clearFilters')}
        </Button>
      )}
    </DataTableToolbar>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
