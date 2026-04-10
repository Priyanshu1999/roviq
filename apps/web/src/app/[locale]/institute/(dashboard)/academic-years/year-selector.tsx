'use client';

import type { AcademicYearStatus } from '@roviq/graphql/generated';
import { Badge, Button, Popover, PopoverContent, PopoverTrigger } from '@roviq/ui';
import { CalendarRange, Check, ChevronsUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import { useAcademicYears } from './use-academic-years';

const STATUS_COLORS: Record<AcademicYearStatus, string> = {
  PLANNING: 'bg-sky-100 text-sky-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  COMPLETING: 'bg-amber-100 text-amber-700',
  ARCHIVED: 'bg-zinc-100 text-zinc-500',
};

/**
 * Academic year selector — persistent dropdown stored in URL via nuqs.
 * Used across academic-years, standards, sections, subjects pages.
 * Defaults to the active year if no year is selected.
 */
export function AcademicYearSelector() {
  const t = useTranslations('academicYears');
  const { years, loading } = useAcademicYears();
  const [selectedId, setSelectedId] = useQueryState('year', parseAsString);

  const activeYear = years.find((y) => y.isActive);
  const effectiveId = selectedId ?? activeYear?.id ?? null;
  const selectedYear = years.find((y) => y.id === effectiveId);

  if (loading || years.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled className="gap-2 font-normal">
        <CalendarRange className="size-4" />
        <span className="text-muted-foreground">{t('selectYear')}</span>
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 font-normal">
          <CalendarRange className="size-4" />
          <span>{selectedYear?.label ?? t('selectYear')}</span>
          {selectedYear?.isActive && (
            <Badge
              variant="secondary"
              className="ms-1 px-1.5 py-0 text-[10px] font-medium bg-emerald-100 text-emerald-700 border-0"
            >
              {t('activeYear')}
            </Badge>
          )}
          <ChevronsUpDown className="ms-auto size-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        <div className="space-y-0.5">
          {years.map((year) => (
            <button
              key={year.id}
              type="button"
              onClick={() => setSelectedId(year.id)}
              className={`
                w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-start
                transition-colors hover:bg-accent
                ${effectiveId === year.id ? 'bg-accent' : ''}
              `}
            >
              {effectiveId === year.id ? (
                <Check className="size-3.5 text-primary" />
              ) : (
                <span className="size-3.5" />
              )}
              <span className="flex-1 font-medium">{year.label}</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[year.status] ?? ''}`}
              >
                {t(`status.${year.status}`)}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Hook to read the currently selected academic year ID from URL */
export function useSelectedAcademicYear() {
  const { years } = useAcademicYears();
  const [selectedId] = useQueryState('year', parseAsString);

  const activeYear = years.find((y) => y.isActive);
  const effectiveId = selectedId ?? activeYear?.id ?? null;

  return {
    yearId: effectiveId,
    year: years.find((y) => y.id === effectiveId) ?? null,
  };
}
