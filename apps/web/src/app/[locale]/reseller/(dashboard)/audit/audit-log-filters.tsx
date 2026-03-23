'use client';

import { useFormatDate } from '@roviq/i18n';
import {
  Button,
  Calendar,
  DataTableToolbar,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { CalendarIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';

const ACTION_TYPES = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'ASSIGN',
  'REVOKE',
  'SUSPEND',
  'ACTIVATE',
] as const;

const ENTITY_TYPES = [
  'User',
  'Role',
  'Student',
  'Section',
  'Standard',
  'Subject',
  'Membership',
  'Institute',
] as const;

const filterParsers = {
  entityType: parseAsString,
  actionType: parseAsString,
  userId: parseAsString,
  tenantId: parseAsString,
  dateFrom: parseAsString,
  dateTo: parseAsString,
};

export function useResellerAuditLogFilters() {
  return useQueryStates(filterParsers);
}

export function ResellerAuditLogFilters() {
  const t = useTranslations('auditLogs');
  const [filters, setFilters] = useQueryStates(filterParsers);

  const { format: formatDate } = useFormatDate();
  const hasFilters = Object.values(filters).some(Boolean);
  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;

  return (
    <DataTableToolbar>
      <div className="relative">
        <Select
          value={filters.entityType ?? ''}
          onValueChange={(value) => setFilters({ entityType: value || null })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('filters.entityType')} />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.entityType && (
          <button
            type="button"
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => setFilters({ entityType: null })}
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="relative">
        <Select
          value={filters.actionType ?? ''}
          onValueChange={(value) => setFilters({ actionType: value || null })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('filters.actionType')} />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`actionTypes.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filters.actionType && (
          <button
            type="button"
            className="absolute right-7 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            onClick={() => setFilters({ actionType: null })}
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <Input
        placeholder={t('filters.userId')}
        value={filters.userId ?? ''}
        onChange={(e) => setFilters({ userId: e.target.value || null })}
        className="w-[200px]"
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
            <CalendarIcon className="me-2 size-4" />
            {dateFrom ? formatDate(dateFrom, 'dd/MM/yyyy') : t('filters.dateFrom')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateFrom}
            onSelect={(date) => setFilters({ dateFrom: date ? date.toISOString() : null })}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
            <CalendarIcon className="me-2 size-4" />
            {dateTo ? formatDate(dateTo, 'dd/MM/yyyy') : t('filters.dateTo')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateTo}
            onSelect={(date) => setFilters({ dateTo: date ? date.toISOString() : null })}
          />
        </PopoverContent>
      </Popover>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setFilters({
              entityType: null,
              actionType: null,
              userId: null,
              tenantId: null,
              dateFrom: null,
              dateTo: null,
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
