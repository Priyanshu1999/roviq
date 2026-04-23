'use client';

import { useFormatDate, useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DataTable,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  useDebounce,
} from '@roviq/ui';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { ArrowLeft, Check, ChevronsUpDown, ClipboardList, User } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { useStudents } from '../../people/students/use-students';
import {
  type AttendanceStatus,
  type StudentHistoryItem,
  useStudentHistory,
} from '../use-attendance';

// Status chip colours mirror the main attendance page so the visual
// language (green = present, rose = absent, etc.) stays consistent.
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ABSENT: 'bg-rose-100 text-rose-700 border-rose-200',
  LEAVE: 'bg-amber-100 text-amber-700 border-amber-200',
  LATE: 'bg-sky-100 text-sky-700 border-sky-200',
};

const STATUS_ORDER: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LEAVE', 'LATE'];

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Split the ISO YYYY-MM-DD manually instead of `new Date(iso)` — avoids
// the UTC-midnight parse drifting by a day in +05:30 when displayed.
function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

// ─────────────────────────────────────────────────────────────────────

export default function AttendanceHistoryPage() {
  const t = useTranslations('attendance');
  const params = useParams();
  const locale = params.locale as string;

  const [studentId, setStudentId] = useQueryState('studentId', parseAsString);
  const [startDate, setStartDate] = useQueryState(
    'startDate',
    parseAsString.withDefault(daysAgoIso(60)),
  );
  const [endDate, setEndDate] = useQueryState('endDate', parseAsString.withDefault(todayIso()));

  return (
    <Can I="read" a="Attendance" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <header className="flex items-center justify-between gap-4">
              <div>
                <h1
                  className="text-2xl font-semibold tracking-tight flex items-center gap-2"
                  data-testid="attendance-history-title"
                >
                  <ClipboardList className="size-6 text-primary" />
                  {t('history.title')}
                </h1>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-2"
                data-testid="attendance-history-back-link"
              >
                <Link href={`/${locale}/institute/attendance/reports`}>
                  <ArrowLeft className="size-4" />
                  {t('history.back')}
                </Link>
              </Button>
            </header>

            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('history.student')}
                    </span>
                    <StudentPicker value={studentId} onChange={(v) => void setStudentId(v)} />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('history.from')}
                    </span>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => void setStartDate(e.target.value || daysAgoIso(60))}
                      data-testid="history-start-date-input"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('history.to')}
                    </span>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => void setEndDate(e.target.value || todayIso())}
                      data-testid="history-end-date-input"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {!studentId ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <User />
                  </EmptyMedia>
                  <EmptyTitle>{t('history.pickStudentHint')}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <HistoryResults studentId={studentId} startDate={startDate} endDate={endDate} />
            )}
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

// ─────────────────────────────────────────────────────────────────────
// Student picker — reuses the listStudents query from the students page
// and wraps it in a Command popover. The search input is debounced
// (250ms) to avoid firing a query on every keystroke.
// ─────────────────────────────────────────────────────────────────────

function StudentPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const t = useTranslations('attendance');
  const resolveI18n = useI18nField();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 250);

  const { students } = useStudents({ first: 50, search: debouncedSearch || undefined });

  const selectedLabel = React.useMemo(() => {
    if (!value) return null;
    const stu = students.find((s) => s.id === value);
    if (!stu) return value.slice(0, 8);
    const first = resolveI18n(stu.firstName) ?? '';
    const last = stu.lastName ? (resolveI18n(stu.lastName) ?? '') : '';
    return `${[first, last].filter(Boolean).join(' ')} · ${stu.admissionNumber}`.trim();
  }, [value, students, resolveI18n]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid="history-student-picker"
        >
          <span className="truncate">{selectedLabel ?? t('history.pickStudent')}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('history.pickStudent')}
            value={search}
            onValueChange={setSearch}
            data-testid="history-student-search-input"
          />
          <CommandList>
            <CommandEmpty>{t('reports.unknownStudent')}</CommandEmpty>
            <CommandGroup>
              {students.map((stu) => {
                const first = resolveI18n(stu.firstName) ?? '';
                const last = stu.lastName ? (resolveI18n(stu.lastName) ?? '') : '';
                const label = `${[first, last].filter(Boolean).join(' ')} · ${stu.admissionNumber}`;
                return (
                  <CommandItem
                    key={stu.id}
                    value={stu.id}
                    onSelect={() => {
                      onChange(stu.id);
                      setOpen(false);
                    }}
                    data-testid={`history-student-option-${stu.id}`}
                  >
                    <Check
                      className={`mr-2 size-4 ${value === stu.id ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Results — summary strip + DataTable
// ─────────────────────────────────────────────────────────────────────

interface HistoryRow extends StudentHistoryItem {
  key: string;
}

function HistoryResults({
  studentId,
  startDate,
  endDate,
}: {
  studentId: string;
  startDate: string;
  endDate: string;
}) {
  const t = useTranslations('attendance');
  const { format } = useFormatDate();
  const { rows, loading } = useStudentHistory(studentId, startDate, endDate);

  const tableRows: HistoryRow[] = React.useMemo(
    () => rows.map((r) => ({ ...r, key: `${r.sessionId}-${r.date}-${r.period ?? 'day'}` })),
    [rows],
  );

  const totals = React.useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      ABSENT: 0,
      LEAVE: 0,
      LATE: 0,
    };
    for (const r of rows) counts[r.status] += 1;
    return counts;
  }, [rows]);

  const columnHelper = createColumnHelper<HistoryRow>();
  const columns: ColumnDef<HistoryRow, unknown>[] = [
    columnHelper.accessor('date', {
      header: t('history.date'),
      cell: ({ getValue, row }) => (
        <span
          className="font-medium tabular-nums"
          data-testid={`history-row-${row.original.key}-date`}
        >
          {format(parseIsoDateLocal(getValue()), 'dd MMM yyyy')}
        </span>
      ),
    }) as ColumnDef<HistoryRow, unknown>,
    columnHelper.accessor('period', {
      header: t('history.period'),
      cell: ({ getValue }) => {
        const p = getValue();
        return (
          <span className="tabular-nums">
            {p === null ? t('history.wholeDay') : `${t('period')} ${p}`}
          </span>
        );
      },
    }) as ColumnDef<HistoryRow, unknown>,
    columnHelper.accessor('subjectId', {
      header: t('history.subject'),
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ?? '—'}</span>,
    }) as ColumnDef<HistoryRow, unknown>,
    columnHelper.accessor('status', {
      header: t('history.status'),
      cell: ({ getValue, row }) => {
        const status = getValue();
        return (
          <Badge
            variant="outline"
            className={STATUS_COLORS[status]}
            data-testid={`history-row-${row.original.key}-status`}
          >
            {t(`counts.${status}` as Parameters<typeof t>[0])}
          </Badge>
        );
      },
    }) as ColumnDef<HistoryRow, unknown>,
    columnHelper.accessor('remarks', {
      header: t('history.remarks'),
      cell: ({ getValue }) => {
        const r = getValue();
        return r ? (
          <span className="text-sm text-muted-foreground">{r}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    }) as ColumnDef<HistoryRow, unknown>,
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" data-testid="history-summary">
        <span className="text-xs font-medium text-muted-foreground">{t('history.summary')}:</span>
        {STATUS_ORDER.map((s) => (
          <Badge
            key={s}
            variant="outline"
            className={`${STATUS_COLORS[s]} border-0`}
            data-testid={`history-summary-${s}`}
          >
            {t(`counts.${s}` as Parameters<typeof t>[0])}: {totals[s]}
          </Badge>
        ))}
      </div>

      {rows.length === 0 && !loading ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>{t('history.noHistory')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <DataTable
          columns={columns}
          data={tableRows}
          isLoading={loading}
          skeletonRows={5}
          data-testid="history-table"
        />
      )}
    </div>
  );
}
