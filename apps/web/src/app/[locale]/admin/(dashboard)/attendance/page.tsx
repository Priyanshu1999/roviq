'use client';

/**
 * Platform-admin cross-tenant attendance view.
 *
 * One row per institute for the chosen date. Row click navigates to the
 * institute detail page so the admin can drill in from the cross-tenant
 * roll-up into a single institute's attendance history.
 */
import { useI18nField } from '@roviq/i18n';
import { Button, Can, DataTable, Input, Label } from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import type { ColumnDef } from '@tanstack/react-table';
import { ClipboardCheck, SearchX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { type AdminAttendanceSummaryNode, useAdminAttendanceSummary } from './use-admin-attendance';

const { adminAttendance } = testIds;

/** ISO date (YYYY-MM-DD) for today in the user's local TZ — matches the roll-up backend's date filter. */
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function computeAttendancePct(present: number, absent: number): number | null {
  const base = present + absent;
  if (base === 0) return null;
  return Math.round((present / base) * 100);
}

export default function AdminAttendancePage() {
  const t = useTranslations('adminAttendance');
  const router = useRouter();
  const resolveI18n = useI18nField();

  const [date, setDate] = useQueryState('date', parseAsString.withDefault(todayIso()));
  const { summaries, loading } = useAdminAttendanceSummary(date);

  const handleRowClick = (row: AdminAttendanceSummaryNode) => {
    router.push(`/admin/institutes/${row.instituteId}`);
  };

  const columns = React.useMemo<ColumnDef<AdminAttendanceSummaryNode, unknown>[]>(
    () => [
      {
        id: 'institute',
        header: t('institute'),
        cell: ({ row }) => (
          // data-testid lives on the name cell because DataTable renders TableRow
          // directly — this is the closest stable anchor per-row for E2E specs.
          <span className="font-medium" data-testid={adminAttendance.row(row.original.instituteId)}>
            {resolveI18n(row.original.instituteName)}
          </span>
        ),
      },
      {
        accessorKey: 'sessionCount',
        header: t('sessions'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.sessionCount}</span>,
      },
      {
        accessorKey: 'presentCount',
        header: t('present'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.presentCount}</span>,
      },
      {
        accessorKey: 'absentCount',
        header: t('absent'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.absentCount}</span>,
      },
      {
        accessorKey: 'leaveCount',
        header: t('leave'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.leaveCount}</span>,
      },
      {
        accessorKey: 'lateCount',
        header: t('late'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.lateCount}</span>,
      },
      {
        id: 'pct',
        header: t('pct'),
        cell: ({ row }) => {
          const pct = computeAttendancePct(row.original.presentCount, row.original.absentCount);
          return <span className="tabular-nums">{pct === null ? '—' : `${pct}%`}</span>;
        },
      },
    ],
    [t, resolveI18n],
  );

  return (
    <div className="space-y-4" data-testid={adminAttendance.page}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid={adminAttendance.title}>
          {t('title')}
        </h1>
      </div>

      <Can I="read" a="Attendance" passThrough>
        {(allowed: boolean) =>
          allowed ? (
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="admin-attendance-date-input">{t('datePicker')}</Label>
                  <Input
                    id="admin-attendance-date-input"
                    data-testid={adminAttendance.dateInput}
                    type="date"
                    value={date}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (next) setDate(next);
                    }}
                    className="w-auto"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid={adminAttendance.todayButton}
                  onClick={() => setDate(todayIso())}
                >
                  {t('today')}
                </Button>
              </div>

              <DataTable
                data-testid={adminAttendance.table}
                columns={columns}
                data={summaries}
                isLoading={loading && summaries.length === 0}
                onRowClick={handleRowClick}
                emptyState={
                  <div
                    className="flex flex-col items-center justify-center gap-3 py-12 text-center"
                    data-testid={adminAttendance.empty}
                  >
                    <SearchX className="size-8 text-muted-foreground" aria-hidden />
                    <p className="text-sm text-muted-foreground">{t('noData')}</p>
                  </div>
                }
              />
            </div>
          ) : (
            <div
              className="flex h-[50vh] items-center justify-center"
              data-testid={adminAttendance.denied}
            >
              <div className="flex flex-col items-center gap-3">
                <ClipboardCheck className="size-8 text-muted-foreground" aria-hidden />
                <p className="text-muted-foreground">{t('accessDenied')}</p>
              </div>
            </div>
          )
        }
      </Can>
    </div>
  );
}
