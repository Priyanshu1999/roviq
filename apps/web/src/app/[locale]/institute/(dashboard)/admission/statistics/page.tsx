'use client';

import {
  Badge,
  Can,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Skeleton,
} from '@roviq/ui';
import { BarChart3, ChartPie, Inbox } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAdmissionStatistics } from '../use-admission';

const { instituteAdmissionStatistics } = testIds;
/**
 * Admission funnel + source breakdown dashboard.
 *
 * Charts:
 *   - Horizontal Bar (acts as funnel) — counts at each stage of the pipeline.
 *   - Pie chart — distribution of enquiries across acquisition sources.
 *   - Conversion rate cards — enquiry → application and application → enrolled.
 *
 * Date-range filtering is a client-side stub for now (the backend
 * `admissionStatistics` query does not yet accept a date range — TODO when
 * ROV-159 follow-up adds the filter input).
 */
type RangeKey = 'thisMonth' | 'lastMonth' | 'thisYear' | 'allTime';

/**
 * Resolve a `RangeKey` to inclusive `from`/`to` ISO dates.
 * `allTime` returns no bounds. `thisYear` is the **academic** year — April
 * through March in the Indian context — not the calendar year.
 */
function rangeToDates(key: RangeKey): { from?: string; to?: string } {
  if (key === 'allTime') return {};
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (key === 'thisMonth') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(start), to: iso(today) };
  }
  if (key === 'lastMonth') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: iso(start), to: iso(end) };
  }
  // thisYear → academic year. Apr–Mar window — if month < April, the year
  // started on April 1 of the *previous* calendar year.
  const startYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
  const start = new Date(startYear, 3, 1);
  return { from: iso(start), to: iso(today) };
}

export default function StatisticsPage() {
  const t = useTranslations('admission');
  const [range, setRange] = React.useState<RangeKey>('allTime');
  const dateFilter = React.useMemo(() => rangeToDates(range), [range]);
  const { data, loading } = useAdmissionStatistics(dateFilter);

  const stats = data?.admissionStatistics;
  const isEmpty = !!stats && stats.totalEnquiries === 0 && stats.totalApplications === 0;

  return (
    <Can I="read" a="Application" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1
                  className="text-2xl font-bold tracking-tight"
                  data-testid={instituteAdmissionStatistics.title}
                >
                  {t('statistics.title')}
                </h1>
                <p className="text-muted-foreground">{t('statistics.description')}</p>
              </div>
              <RangeSelector value={range} onChange={setRange} />
            </div>

            {loading && !stats && (
              <div
                className="grid grid-cols-1 gap-4 md:grid-cols-4"
                data-testid={instituteAdmissionStatistics.loading}
              >
                {(['enquiries', 'applications', 'enq-app', 'app-enrol'] as const).map((k) => (
                  <Skeleton key={k} className="h-28 w-full" />
                ))}
              </div>
            )}

            {stats && isEmpty && (
              <Empty className="py-16">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle data-testid={instituteAdmissionStatistics.empty}>
                    {t('statistics.empty')}
                  </EmptyTitle>
                  <EmptyDescription>{t('statistics.empty')}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            {stats && !isEmpty && (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <KpiCard
                    label={t('statistics.totalEnquiries')}
                    value={stats.totalEnquiries}
                    testId="kpi-total-enquiries"
                  />
                  <KpiCard
                    label={t('statistics.totalApplications')}
                    value={stats.totalApplications}
                    testId="kpi-total-applications"
                  />
                  <KpiCard
                    label={t('statistics.enquiryToApp')}
                    value={`${(stats.enquiryToApplicationRate * 100).toFixed(1)}%`}
                    testId="kpi-enq-to-app"
                  />
                  <KpiCard
                    label={t('statistics.appToEnrolled')}
                    value={`${(stats.applicationToEnrolledRate * 100).toFixed(1)}%`}
                    testId="kpi-app-to-enrolled"
                  />
                </div>

                {/* Funnel + source breakdown */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <FunnelChartCard funnel={stats.funnel} totalEnquiries={stats.totalEnquiries} />
                  <SourceBreakdownCard bySource={stats.bySource} />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex min-h-[400px] items-center justify-center">
            <p className="text-muted-foreground">{t('accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: string | number;
  testId: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums" data-testid={testId}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function RangeSelector({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  const t = useTranslations('admission');
  const options: Array<{ key: RangeKey; label: string }> = [
    { key: 'thisMonth', label: t('statistics.range.thisMonth') },
    { key: 'lastMonth', label: t('statistics.range.lastMonth') },
    { key: 'thisYear', label: t('statistics.range.thisYear') },
    { key: 'allTime', label: t('statistics.range.allTime') },
  ];
  return (
    <div className="inline-flex rounded-md border bg-background p-0.5" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          role="tab"
          aria-selected={value === opt.key}
          data-testid={`range-${opt.key}`}
          className={`rounded px-3 py-1 text-xs font-medium ${
            value === opt.key
              ? 'bg-secondary text-secondary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const STAGE_COLORS: Record<string, string> = {
  SUBMITTED: '#3b82f6',
  DOCUMENTS_VERIFIED: '#f59e0b',
  TEST_COMPLETED: '#a855f7',
  INTERVIEW_COMPLETED: '#a855f7',
  MERIT_LISTED: '#22c55e',
  OFFER_MADE: '#22c55e',
  OFFER_ACCEPTED: '#22c55e',
  FEE_PENDING: '#f59e0b',
  FEE_PAID: '#14b8a6',
  ENROLLED: '#10b981',
};

function FunnelChartCard({
  funnel,
  totalEnquiries,
}: {
  funnel: Array<{ stage: string; count: number }>;
  totalEnquiries: number;
}) {
  const t = useTranslations('admission');

  // Prepend the enquiry total so the chart literally reads as a funnel:
  // enquiry → application → ... → enrolled.
  const data = React.useMemo(
    () => [
      { stage: t('statistics.totalEnquiries'), count: totalEnquiries, key: 'ENQUIRY' },
      ...funnel.map((f) => ({
        stage: t(`applicationStatuses.${f.stage}`, { default: f.stage }),
        count: f.count,
        key: f.stage,
      })),
    ],
    [funnel, totalEnquiries, t],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 aria-hidden="true" className="size-5" />
          {t('statistics.funnelTitle')}
        </CardTitle>
        <CardDescription>{t('statistics.funnelDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div data-testid={instituteAdmissionStatistics.funnelChart} className="h-[360px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={data} margin={{ left: 24, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis dataKey="stage" type="category" width={140} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.key} fill={STAGE_COLORS[entry.key] ?? '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

const SOURCE_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#14b8a6',
  '#ec4899',
  '#ef4444',
  '#0ea5e9',
  '#8b5cf6',
  '#84cc16',
  '#f97316',
  '#64748b',
];

function SourceBreakdownCard({
  bySource,
}: {
  bySource: Array<{ source: string; enquiryCount: number; applicationCount: number }>;
}) {
  const t = useTranslations('admission');
  const data = bySource
    .filter((b) => b.enquiryCount > 0)
    .map((b, i) => ({
      ...b,
      label: t(`sources.${b.source}`, { default: b.source }),
      color: SOURCE_COLORS[i % SOURCE_COLORS.length],
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChartPie aria-hidden="true" className="size-5" />
          {t('statistics.sourceTitle')}
        </CardTitle>
        <CardDescription>{t('statistics.sourceDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('statistics.empty')}</p>
        ) : (
          <>
            <div
              data-testid={instituteAdmissionStatistics.sourcePieChart}
              className="h-[280px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip />
                  <Legend />
                  <Pie
                    data={data}
                    dataKey="enquiryCount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.source} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Conversion-per-source table — supplements the visual chart with
                the explicit enquiry → application count for each source so
                users can read both attribution and conversion at a glance. */}
            <div
              className="mt-4 space-y-1.5"
              data-testid={instituteAdmissionStatistics.sourceConversionList}
            >
              {data.map((entry) => {
                const rate =
                  entry.enquiryCount > 0
                    ? ((entry.applicationCount / entry.enquiryCount) * 100).toFixed(0)
                    : '0';
                return (
                  <div
                    key={entry.source}
                    className="flex items-center justify-between text-sm"
                    data-testid={`source-row-${entry.source}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                        aria-hidden="true"
                      />
                      <span>{entry.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground tabular-nums">
                        {entry.applicationCount}/{entry.enquiryCount}
                      </span>
                      <Badge variant="outline" className="tabular-nums">
                        {rate}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
