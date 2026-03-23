'use client';

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
import { format } from 'date-fns';
import { CalendarIcon, Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  'Timetable',
  'Attendance',
  'Membership',
] as const;

const filterParsers = {
  entityType: parseAsString,
  actionType: parseAsString,
  userId: parseAsString,
  entityId: parseAsString,
  dateFrom: parseAsString,
  dateTo: parseAsString,
};

export function useAuditLogFilters() {
  return useQueryStates(filterParsers);
}

export function AuditLogFilters() {
  const t = useTranslations('auditLogs');
  const [filters, setFilters] = useQueryStates(filterParsers);

  const hasFilters = Object.values(filters).some(Boolean);

  const dateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
  const dateTo = filters.dateTo ? new Date(filters.dateTo) : undefined;

  const [entityIdInput, setEntityIdInput] = React.useState(filters.entityId ?? '');
  const [entityIdError, setEntityIdError] = React.useState<string | null>(null);

  const handleEntityIdSearch = () => {
    const value = entityIdInput.trim();
    if (!value) {
      setFilters({ entityId: null });
      setEntityIdError(null);
      return;
    }
    if (!UUID_REGEX.test(value)) {
      setEntityIdError(t('search.invalidId'));
      return;
    }
    setEntityIdError(null);
    setFilters({ entityId: value });
  };

  return (
    <DataTableToolbar>
      {/* "Who changed this?" entity ID search */}
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <Input
            placeholder={t('search.placeholder')}
            value={entityIdInput}
            onChange={(e) => {
              setEntityIdInput(e.target.value);
              if (entityIdError) setEntityIdError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEntityIdSearch();
            }}
            className={`w-[280px] font-mono text-xs ${entityIdError ? 'border-destructive' : ''}`}
          />
          {entityIdError && (
            <span className="absolute -bottom-5 left-0 text-[11px] text-destructive">
              {entityIdError}
            </span>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={handleEntityIdSearch}>
          <Search className="size-4" />
        </Button>
        {filters.entityId && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setEntityIdInput('');
              setEntityIdError(null);
              setFilters({ entityId: null });
            }}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

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

      {/* Date From */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
            <CalendarIcon className="me-2 size-4" />
            {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : t('filters.dateFrom')}
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

      {/* Date To */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-[140px] justify-start text-left font-normal">
            <CalendarIcon className="me-2 size-4" />
            {dateTo ? format(dateTo, 'dd/MM/yyyy') : t('filters.dateTo')}
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
          onClick={() => {
            setEntityIdInput('');
            setEntityIdError(null);
            setFilters({
              entityType: null,
              actionType: null,
              userId: null,
              entityId: null,
              dateFrom: null,
              dateTo: null,
            });
          }}
        >
          <X className="me-1 size-4" />
          {t('filters.clearFilters')}
        </Button>
      )}
    </DataTableToolbar>
  );
}
