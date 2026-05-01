'use client';

import { useFormatDate, useI18nField } from '@roviq/i18n';
import { Button, Popover, PopoverContent, PopoverTrigger, Skeleton } from '@roviq/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { type HolidayRecord, type HolidayType, useHolidays } from './use-holiday';

const { instituteHoliday } = testIds;
// Tailwind pill classes per Holiday `type`. Kept next to the component
// so the palette is obvious at the call-site. 100-shade background with
// 800-shade text keeps contrast above AA on the default card surface.
const HOLIDAY_TYPE_PILL: Record<HolidayType, string> = {
  NATIONAL: 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200',
  STATE: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200',
  RELIGIOUS: 'bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-200',
  INSTITUTE: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200',
  SUMMER_BREAK: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200',
  WINTER_BREAK: 'bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200',
  OTHER: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200',
};

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIsoMonth(value: string | null): { year: number; month: number } {
  if (value) {
    const match = /^(\d{4})-(\d{2})$/.exec(value);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      if (Number.isFinite(year) && month >= 0 && month <= 11) {
        return { year, month };
      }
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function formatMonthParam(year: number, month: number): string {
  return `${year}-${pad2(month + 1)}`;
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

// Monday-first week. JS `getDay()` returns 0 (Sun) … 6 (Sat); shift so Mon=0.
function mondayFirstIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

interface MonthGridCell {
  date: Date;
  iso: string;
  inMonth: boolean;
}

function buildMonthCells(year: number, month: number): MonthGridCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const offset = mondayFirstIndex(firstOfMonth.getDay());
  const gridStart = new Date(year, month, 1 - offset);
  // 6 weeks keeps layout stable regardless of month length or start-day.
  const cells: MonthGridCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({
      date: d,
      iso: toIsoDay(d),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}

function monthRangeIso(year: number, month: number): { startDate: string; endDate: string } {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0); // last day of the month.
  return { startDate: toIsoDay(start), endDate: toIsoDay(end) };
}

// Bucket holidays by ISO day. Multi-day holidays show on every day
// they cover. Sorted ascending by start so visual order is stable.
function groupByDay(holidays: HolidayRecord[]): Map<string, HolidayRecord[]> {
  const byDay = new Map<string, HolidayRecord[]>();
  const sorted = [...holidays].sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const h of sorted) {
    const start = parseIsoDateLocal(h.startDate);
    const end = parseIsoDateLocal(h.endDate);
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor.getTime() <= end.getTime()) {
      const iso = toIsoDay(cursor);
      const bucket = byDay.get(iso);
      if (bucket) bucket.push(h);
      else byDay.set(iso, [h]);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return byDay;
}

interface HolidayPillProps {
  holiday: HolidayRecord;
  locale: string;
  label: string;
}

function HolidayPill({ holiday, locale, label }: HolidayPillProps) {
  return (
    <Link
      href={`/${locale}/institute/holiday/${holiday.id}`}
      data-testid={`holiday-calendar-pill-${holiday.id}`}
      className={`block w-full truncate rounded-sm border px-1.5 py-0.5 text-left text-[11px] font-medium leading-tight transition-colors ${HOLIDAY_TYPE_PILL[holiday.type]}`}
      title={label}
    >
      {label}
    </Link>
  );
}

export function HolidayCalendar() {
  const t = useTranslations('holiday');
  const { format } = useFormatDate();
  const resolveI18n = useI18nField();
  const params = useParams();
  const locale = params.locale as string;

  const currentMonthParam = React.useMemo(() => {
    const now = new Date();
    return formatMonthParam(now.getFullYear(), now.getMonth());
  }, []);

  const [monthParam, setMonthParam] = useQueryState(
    'month',
    parseAsString.withDefault(currentMonthParam),
  );

  const { year, month } = React.useMemo(() => parseIsoMonth(monthParam), [monthParam]);
  const { startDate, endDate } = React.useMemo(() => monthRangeIso(year, month), [year, month]);

  const { holidays, loading } = useHolidays({ startDate, endDate });

  const byDay = React.useMemo(() => groupByDay(holidays), [holidays]);
  const cells = React.useMemo(() => buildMonthCells(year, month), [year, month]);

  const todayIso = React.useMemo(() => toIsoDay(new Date()), []);
  const monthHeading = React.useMemo(
    () => format(new Date(year, month, 1), 'MMMM yyyy'),
    [format, year, month],
  );

  const goPrev = React.useCallback(() => {
    const prev = new Date(year, month - 1, 1);
    void setMonthParam(formatMonthParam(prev.getFullYear(), prev.getMonth()));
  }, [setMonthParam, year, month]);

  const goNext = React.useCallback(() => {
    const next = new Date(year, month + 1, 1);
    void setMonthParam(formatMonthParam(next.getFullYear(), next.getMonth()));
  }, [setMonthParam, year, month]);

  const goToday = React.useCallback(() => {
    const now = new Date();
    void setMonthParam(formatMonthParam(now.getFullYear(), now.getMonth()));
  }, [setMonthParam]);

  return (
    <div className="rounded-lg border bg-card" data-testid={instituteHoliday.calendar}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 sm:p-4">
        <h2
          className="text-lg font-semibold tracking-tight"
          data-testid={instituteHoliday.calendarHeading}
        >
          {monthHeading}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goPrev}
            className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9"
            aria-label={t('calendar.prev')}
            data-testid={instituteHoliday.calendarPrevBtn}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goToday}
            className="min-h-11 sm:min-h-9"
            data-testid={instituteHoliday.calendarTodayBtn}
          >
            {t('calendar.today')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goNext}
            className="min-h-11 min-w-11 sm:min-h-9 sm:min-w-9"
            aria-label={t('calendar.next')}
            data-testid={instituteHoliday.calendarNextBtn}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
        {WEEKDAY_KEYS.map((key: WeekdayKey) => (
          <div key={key} className="px-2 py-2 text-center uppercase tracking-wide">
            {t(`calendar.weekdays.${key}`)}
          </div>
        ))}
      </div>

      {loading && holidays.length === 0 ? (
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }, (_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: placeholder skeleton grid
              key={i}
              className="min-h-11 border-b border-r p-1 sm:min-h-[72px] md:min-h-[72px]"
            >
              <Skeleton className="h-4 w-6" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const dayHolidays = byDay.get(cell.iso) ?? [];
            const visible = dayHolidays.slice(0, 2);
            const overflow = dayHolidays.length - visible.length;
            const isToday = cell.iso === todayIso;

            return (
              <div
                key={cell.iso}
                data-testid={`holiday-calendar-day-${cell.iso}`}
                data-in-month={cell.inMonth}
                data-today={isToday}
                className={`flex min-h-11 min-w-11 flex-col gap-1 border-b border-r p-1 sm:min-h-[72px] md:h-[72px] md:min-h-[72px] md:min-w-[88px] ${
                  cell.inMonth ? 'bg-background' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
                      isToday
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : cell.inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                </div>
                {visible.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    {visible.map((h) => (
                      <HolidayPill
                        key={h.id}
                        holiday={h}
                        locale={locale}
                        label={resolveI18n(h.name) || h.id.slice(0, 8)}
                      />
                    ))}
                    {overflow > 0 ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="w-full truncate rounded-sm border border-dashed border-border bg-muted/40 px-1.5 py-0.5 text-left text-[11px] font-medium text-muted-foreground hover:bg-muted"
                            data-testid={`holiday-calendar-more-${cell.iso}`}
                          >
                            {t('calendar.moreLabel', { count: overflow })}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64">
                          <div className="flex flex-col gap-1">
                            <div className="text-xs font-medium text-muted-foreground">
                              {format(cell.date, 'dd MMM yyyy')}
                            </div>
                            {dayHolidays.map((h) => (
                              <HolidayPill
                                key={h.id}
                                holiday={h}
                                locale={locale}
                                label={resolveI18n(h.name) || h.id.slice(0, 8)}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
