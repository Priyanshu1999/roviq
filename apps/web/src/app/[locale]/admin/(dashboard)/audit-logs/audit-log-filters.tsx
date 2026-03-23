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
} from '@roviq/ui';
import { X } from 'lucide-react';
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
  'Timetable',
  'Attendance',
] as const;

const filterParsers = {
  entityType: parseAsString,
  actionType: parseAsString,
  userId: parseAsString,
};

export function useAuditLogFilters() {
  return useQueryStates(filterParsers);
}

export function AuditLogFilters() {
  const t = useTranslations('auditLogs');
  const [filters, setFilters] = useQueryStates(filterParsers);

  const hasFilters = Object.values(filters).some(Boolean);

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

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ entityType: null, actionType: null, userId: null })}
        >
          <X className="me-1 size-4" />
          {t('filters.clearFilters')}
        </Button>
      )}
    </DataTableToolbar>
  );
}
