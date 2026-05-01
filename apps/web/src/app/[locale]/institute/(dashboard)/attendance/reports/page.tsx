'use client';

import { useFormatDate, useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  DataTable,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { ArrowLeft, BarChart3, CalendarDays, Download, History, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { useAcademicYears } from '../../academic-years/use-academic-years';
import { useSections, useStandards } from '../../academics/use-academics';
import { useStudents } from '../../people/students/use-students';
import {
  type AbsenteeReportItem,
  type SectionDailyBreakdown,
  useAbsenteesReport,
  useSectionDailyBreakdown,
  useStudentsInSection,
} from '../use-attendance';

const { instituteAttendance } = testIds;
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

// ── CSV helpers ────────────────────────────────────────────────────────
// Inline on purpose (not a shared util yet) — RFC 4180 quoting is the
// only rule we need for a two-button export. If a third consumer shows
// up we promote this to libs/ui or libs/common-types.

function csvEscape(value: string | number): string {
  const s = String(value);
  // Double any embedded quotes and wrap the whole field in quotes.
  return `"${s.replace(/"/g, '""')}"`;
}

function buildCsv(headers: readonly string[], rows: readonly (string | number)[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  // Leading BOM so Excel opens UTF-8 (हिन्दी) cleanly on Windows.
  return `﻿${lines.join('\n')}`;
}

function triggerDownload(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────
// Entry point — wraps the two tabs with scope + back link
// ─────────────────────────────────────────────────────────────────────

export default function AttendanceReportsPage() {
  const t = useTranslations('attendance');
  const params = useParams();
  const locale = params.locale as string;
  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('absentees'));

  return (
    <Can I="read" a="Attendance" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <header className="flex items-center justify-between gap-4">
              <div>
                <h1
                  className="text-2xl font-semibold tracking-tight flex items-center gap-2"
                  data-testid={instituteAttendance.reportsTitle}
                >
                  <BarChart3 className="size-6 text-primary" />
                  {t('reports.title')}
                </h1>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-2"
                data-testid={instituteAttendance.reportsBackLink}
              >
                <Link href={`/${locale}/institute/attendance`}>
                  <ArrowLeft className="size-4" />
                  {t('reports.back')}
                </Link>
              </Button>
            </header>

            <Tabs value={tab} onValueChange={(v) => void setTab(v)}>
              <TabsList data-testid={instituteAttendance.reportsTabs}>
                <TabsTrigger
                  value="absentees"
                  data-testid={instituteAttendance.reportsTabAbsentees}
                >
                  {t('reports.tab.absentees')}
                </TabsTrigger>
                <TabsTrigger value="daily" data-testid={instituteAttendance.reportsTabDaily}>
                  {t('reports.tab.daily')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="absentees" className="mt-4">
                <AbsenteesByStudentTab />
              </TabsContent>

              <TabsContent value="daily" className="mt-4">
                <DailyBreakdownTab />
              </TabsContent>
            </Tabs>
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
// Tab 1 — Absentees by student
// ─────────────────────────────────────────────────────────────────────

interface AbsenteeRow extends AbsenteeReportItem {
  studentName: string;
  admissionNumber: string;
  absentPct: number;
}

function AbsenteesByStudentTab() {
  const t = useTranslations('attendance');
  const resolveI18n = useI18nField();
  const params = useParams();
  const locale = params.locale as string;

  const [startDate, setStartDate] = useQueryState(
    'startDate',
    parseAsString.withDefault(daysAgoIso(30)),
  );
  const [endDate, setEndDate] = useQueryState('endDate', parseAsString.withDefault(todayIso()));
  const [standardId, setStandardId] = useQueryState('standard', parseAsString);
  const [sectionId, setSectionId] = useQueryState('section', parseAsString);

  const { years } = useAcademicYears();
  const activeYearId = years.find((y) => y.status === 'ACTIVE')?.id ?? null;
  const { standards } = useStandards(activeYearId);
  const { sections } = useSections(standardId);

  const { rows, loading } = useAbsenteesReport(sectionId, startDate, endDate);
  const { students } = useStudentsInSection(sectionId);

  // Build a membershipId → student map so the table can render names
  // without an extra round-trip. Only students in the selected section
  // are available; rows without a match fall back to a masked id.
  const studentById = React.useMemo(() => {
    const map = new Map<string, (typeof students)[number]>();
    for (const s of students) map.set(s.membershipId, s);
    return map;
  }, [students]);

  const tableRows: AbsenteeRow[] = React.useMemo(() => {
    return rows.map((r) => {
      const stu = studentById.get(r.studentId);
      const first = stu ? resolveI18n(stu.firstName) : '';
      const last = stu?.lastName ? resolveI18n(stu.lastName) : '';
      const studentName = [first, last].filter(Boolean).join(' ').trim();
      const absentPct =
        r.totalSessions > 0 ? Math.round((r.absentCount / r.totalSessions) * 100) : 0;
      return {
        ...r,
        studentName: studentName || t('reports.unknownStudent'),
        admissionNumber: stu?.admissionNumber ?? '—',
        absentPct,
      };
    });
  }, [rows, studentById, resolveI18n, t]);

  const columnHelper = createColumnHelper<AbsenteeRow>();

  const columns: ColumnDef<AbsenteeRow, unknown>[] = [
    columnHelper.accessor('studentName', {
      header: t('student'),
      cell: ({ row }) => (
        <span className="font-medium" data-testid={`absentees-row-${row.original.studentId}-name`}>
          {row.original.studentName}
        </span>
      ),
    }) as ColumnDef<AbsenteeRow, unknown>,
    columnHelper.accessor('admissionNumber', {
      header: t('admissionNumber'),
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue()}</span>,
    }) as ColumnDef<AbsenteeRow, unknown>,
    columnHelper.accessor('totalSessions', {
      header: t('reports.totalSessions'),
      cell: ({ getValue }) => <span className="tabular-nums">{getValue()}</span>,
    }) as ColumnDef<AbsenteeRow, unknown>,
    columnHelper.accessor('presentCount', {
      header: t('reports.presentCount'),
      cell: ({ getValue }) => <span className="tabular-nums text-emerald-700">{getValue()}</span>,
    }) as ColumnDef<AbsenteeRow, unknown>,
    columnHelper.accessor('absentCount', {
      header: t('reports.absentCount'),
      cell: ({ getValue }) => <span className="tabular-nums text-rose-700">{getValue()}</span>,
    }) as ColumnDef<AbsenteeRow, unknown>,
    columnHelper.accessor('leaveCount', {
      header: t('reports.leaveCount'),
      cell: ({ getValue }) => <span className="tabular-nums text-amber-700">{getValue()}</span>,
    }) as ColumnDef<AbsenteeRow, unknown>,
    columnHelper.accessor('lateCount', {
      header: t('reports.lateCount'),
      cell: ({ getValue }) => <span className="tabular-nums text-sky-700">{getValue()}</span>,
    }) as ColumnDef<AbsenteeRow, unknown>,
    columnHelper.accessor('absentPct', {
      header: t('reports.absentPct'),
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.original.absentPct >= 25
              ? 'bg-rose-100 text-rose-700 border-rose-200'
              : 'bg-muted text-muted-foreground border-0'
          }
          data-testid={`absentees-row-${row.original.studentId}-pct`}
        >
          {row.original.absentPct}%
        </Badge>
      ),
    }) as ColumnDef<AbsenteeRow, unknown>,
    columnHelper.accessor('absentDates', {
      header: t('reports.absentDates'),
      cell: ({ row }) => <AbsentDatesCell dates={row.original.absentDates} />,
    }) as ColumnDef<AbsenteeRow, unknown>,
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1 h-7 px-2 text-xs"
          data-testid={`absentees-row-${row.original.studentId}-history-btn`}
        >
          <Link
            href={`/${locale}/institute/attendance/history?studentId=${
              row.original.studentId
            }&startDate=${startDate}&endDate=${endDate}`}
          >
            <History className="size-3.5" />
            {t('reports.viewHistory')}
          </Link>
        </Button>
      ),
    }) as ColumnDef<AbsenteeRow, unknown>,
  ];

  function handleExport() {
    const headers = [
      t('student'),
      t('admissionNumber'),
      t('reports.totalSessions'),
      t('reports.presentCount'),
      t('reports.absentCount'),
      t('reports.leaveCount'),
      t('reports.lateCount'),
      t('reports.absentPct'),
      t('reports.absentDates'),
    ];
    const body: (string | number)[][] = tableRows.map((r) => [
      `${r.studentName} (${r.admissionNumber})`,
      r.admissionNumber,
      r.totalSessions,
      r.presentCount,
      r.absentCount,
      r.leaveCount,
      r.lateCount,
      `${r.absentPct}%`,
      r.absentDates.join(';'),
    ]);
    triggerDownload(`attendance-absentees-${startDate}_${endDate}.csv`, buildCsv(headers, body));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('reports.from')}
              </span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => void setStartDate(e.target.value || daysAgoIso(30))}
                data-testid={instituteAttendance.absenteesStartDateInput}
              />
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('reports.to')}
              </span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => void setEndDate(e.target.value || todayIso())}
                data-testid={instituteAttendance.absenteesEndDateInput}
              />
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('reports.pickStandard')}
              </span>
              <Select
                value={standardId ?? '__all__'}
                onValueChange={(v) => {
                  void setStandardId(v === '__all__' ? null : v);
                  void setSectionId(null);
                }}
              >
                <SelectTrigger data-testid={instituteAttendance.absenteesStandardSelect}>
                  <SelectValue placeholder={t('reports.allStandards')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('reports.allStandards')}</SelectItem>
                  {standards.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {resolveI18n(s.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('reports.pickSection')}
              </span>
              <Select
                value={sectionId ?? '__all__'}
                onValueChange={(v) => void setSectionId(v === '__all__' ? null : v)}
                disabled={!standardId}
              >
                <SelectTrigger data-testid={instituteAttendance.absenteesSectionSelect}>
                  <SelectValue placeholder={t('reports.allSections')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('reports.allSections')}</SelectItem>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.displayLabel ?? resolveI18n(s.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {!sectionId ? (
            <p
              className="text-xs text-muted-foreground mt-3"
              data-testid={instituteAttendance.absenteesSectionHint}
            >
              {t('reports.pickSectionHint')}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {rows.length === 0 && !loading ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>{t('reports.noAbsences')}</EmptyTitle>
            <EmptyDescription>
              {t('reports.from')}: {startDate} · {t('reports.to')}: {endDate}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExport}
              disabled={tableRows.length === 0}
              data-testid={instituteAttendance.absenteesExportCsvBtn}
            >
              <Download className="size-4" />
              {t('reports.exportCsv')}
            </Button>
          </div>
          <DataTable
            columns={columns}
            data={tableRows}
            isLoading={loading}
            skeletonRows={5}
            data-testid={instituteAttendance.absenteesTable}
          />
        </div>
      )}
    </div>
  );
}

// Absent-dates column cell: shows first 3 as badges, rest inside a popover
function AbsentDatesCell({ dates }: { dates: string[] }) {
  const t = useTranslations('attendance');
  const { format } = useFormatDate();
  if (dates.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const pretty = (iso: string) => {
    // Avoid Date parsing drift across timezones: split ISO YYYY-MM-DD manually.
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    return format(dt, 'dd MMM');
  };
  const visible = dates.slice(0, 3);
  const hidden = dates.slice(3);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((d) => (
        <Badge
          key={d}
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-normal"
          title={d}
        >
          {pretty(d)}
        </Badge>
      ))}
      {hidden.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              data-testid={instituteAttendance.absentDatesMoreBtn}
            >
              {t('reports.moreDates', { count: hidden.length })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <div className="flex flex-wrap gap-1">
              {hidden.map((d) => (
                <Badge
                  key={d}
                  variant="outline"
                  className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-normal"
                  title={d}
                >
                  {pretty(d)}
                </Badge>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tab 2 — Daily breakdown
// ─────────────────────────────────────────────────────────────────────

interface DailyBreakdownRow extends SectionDailyBreakdown {
  sectionLabel: string;
}

function DailyBreakdownTab() {
  const t = useTranslations('attendance');
  const resolveI18n = useI18nField();

  const [date, setDate] = useQueryState('date', parseAsString.withDefault(todayIso()));
  const [standardId, setStandardId] = useQueryState('breakdownStandard', parseAsString);

  const { years } = useAcademicYears();
  const activeYearId = years.find((y) => y.status === 'ACTIVE')?.id ?? null;
  const { standards } = useStandards(activeYearId);
  const { sections } = useSections(standardId);

  const { rows, loading } = useSectionDailyBreakdown(date);

  // Resolve absentee membership ids → readable names. The query returns
  // membership ids; we fetch the first 200 students of the institute and
  // build a lookup. Unknown ids fall back to a masked chip.
  const { students } = useStudents({ first: 200 });
  const nameByMembership = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      const first = resolveI18n(s.firstName) ?? '';
      const last = s.lastName ? (resolveI18n(s.lastName) ?? '') : '';
      const fullName = [first, last].filter(Boolean).join(' ');
      map.set(s.membershipId, fullName || s.admissionNumber);
    }
    return map;
  }, [students, resolveI18n]);

  // Map sectionId → label using the sections-for-selected-standard query.
  // When no standard is selected we show a masked id; picking a standard
  // resolves names for rows under it (and hides others).
  const sectionById = React.useMemo(() => {
    const map = new Map<string, (typeof sections)[number]>();
    for (const s of sections) map.set(s.id, s);
    return map;
  }, [sections]);

  const filteredRows: DailyBreakdownRow[] = React.useMemo(() => {
    const list = standardId ? rows.filter((r) => sectionById.has(r.sectionId)) : rows;
    return list.map((r) => {
      // Prefer the backend-provided section name (always populated via the
      // server-side JOIN); fall back to the standard-scoped display label
      // when present, then to a masked id as a last resort.
      const sec = sectionById.get(r.sectionId);
      const label =
        resolveI18n(r.sectionName) ??
        sec?.displayLabel ??
        (sec ? resolveI18n(sec.name) : null) ??
        t('reports.unknownSection', { id: r.sectionId.slice(0, 8) });
      return { ...r, sectionLabel: label };
    });
  }, [rows, sectionById, standardId, resolveI18n, t]);

  function handleExport() {
    const headers = [
      t('reports.section'),
      t('period'),
      t('reports.lecturer'),
      t('reports.presentCount'),
      t('reports.absentCount'),
      t('reports.leaveCount'),
      t('reports.lateCount'),
      t('reports.absentees'),
    ];
    const body: (string | number)[][] = filteredRows.map((r) => [
      r.sectionLabel,
      r.period === null ? t('dailyMode') : `${t('period')} ${r.period}`,
      r.lecturerId,
      r.presentCount,
      r.absentCount,
      r.leaveCount,
      r.lateCount,
      r.absenteeIds.join(';'),
    ]);
    triggerDownload(`attendance-daily-${date}.csv`, buildCsv(headers, body));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('reports.datePicker')}
              </span>
              <Input
                type="date"
                value={date}
                onChange={(e) => void setDate(e.target.value || todayIso())}
                data-testid={instituteAttendance.breakdownDateInput}
              />
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('reports.pickStandard')}
              </span>
              <Select
                value={standardId ?? '__all__'}
                onValueChange={(v) => void setStandardId(v === '__all__' ? null : v)}
              >
                <SelectTrigger data-testid={instituteAttendance.breakdownStandardSelect}>
                  <SelectValue placeholder={t('reports.allStandards')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">{t('reports.allStandards')}</SelectItem>
                  {standards.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {resolveI18n(s.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredRows.length === 0 && !loading ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>{t('reports.noBreakdown')}</EmptyTitle>
            <EmptyDescription>{date}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleExport}
              disabled={filteredRows.length === 0}
              data-testid={instituteAttendance.dailyExportCsvBtn}
            >
              <Download className="size-4" />
              {t('reports.exportCsv')}
            </Button>
          </div>
          <div
            className="rounded-lg border overflow-hidden"
            data-testid={instituteAttendance.breakdownTable}
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('reports.section')}</th>
                  <th className="px-4 py-2 font-medium">{t('period')}</th>
                  <th className="px-4 py-2 font-medium text-emerald-700">
                    {t('reports.presentCount')}
                  </th>
                  <th className="px-4 py-2 font-medium text-rose-700">
                    {t('reports.absentCount')}
                  </th>
                  <th className="px-4 py-2 font-medium text-amber-700">
                    {t('reports.leaveCount')}
                  </th>
                  <th className="px-4 py-2 font-medium text-sky-700">{t('reports.lateCount')}</th>
                  <th className="px-4 py-2 font-medium">{t('reports.absentees')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr
                    key={`${r.sectionId}-${r.period ?? 'day'}-${r.lecturerId}`}
                    className="border-t"
                    data-testid={`breakdown-row-${r.sectionId}-${r.period ?? 'day'}`}
                  >
                    <td className="px-4 py-2 font-medium">{r.sectionLabel}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {r.period === null ? t('dailyMode') : `${t('period')} ${r.period}`}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-emerald-700">{r.presentCount}</td>
                    <td className="px-4 py-2 tabular-nums text-rose-700">{r.absentCount}</td>
                    <td className="px-4 py-2 tabular-nums text-amber-700">{r.leaveCount}</td>
                    <td className="px-4 py-2 tabular-nums text-sky-700">{r.lateCount}</td>
                    <td className="px-4 py-2">
                      <AbsenteeChips ids={r.absenteeIds} nameByMembership={nameByMembership} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AbsenteeChips({
  ids,
  nameByMembership,
}: {
  ids: string[];
  nameByMembership: Map<string, string>;
}) {
  const t = useTranslations('attendance');
  if (ids.length === 0) {
    return <span className="text-xs text-muted-foreground">{t('reports.noAbsenteesRow')}</span>;
  }
  const label = (id: string) => nameByMembership.get(id) ?? id.slice(0, 8);
  const visible = ids.slice(0, 3);
  const hidden = ids.slice(3);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((id) => (
        <Badge
          key={id}
          variant="outline"
          className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-normal"
          data-testid={`breakdown-absentee-${id}`}
          title={id}
        >
          {label(id)}
        </Badge>
      ))}
      {hidden.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              data-testid={instituteAttendance.breakdownMoreAbsenteesBtn}
            >
              {t('reports.moreDates', { count: hidden.length })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <div className="flex flex-wrap gap-1">
              {hidden.map((id) => (
                <Badge
                  key={id}
                  variant="outline"
                  className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-normal"
                  title={id}
                >
                  {label(id)}
                </Badge>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
