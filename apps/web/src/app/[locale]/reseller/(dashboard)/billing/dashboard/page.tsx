'use client';

import { gql, useQuery } from '@roviq/graphql';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@roviq/ui';
import { AlertTriangle, BarChart3, IndianRupee, TrendingUp, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

/**
 * Dynamically import Recharts components to avoid SSR issues.
 * Recharts internally uses D3 which requires DOM access.
 */
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const PieChart = dynamic(() => import('recharts').then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then((m) => m.Cell), { ssr: false });
const Legend = dynamic(() => import('recharts').then((m) => m.Legend), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then((m) => m.Tooltip), { ssr: false });

/** Color mapping for subscription statuses used in the pie chart. */
const STATUS_COLORS: Record<string, string> = {
  /** Active — subscription is currently billing and in good standing. */
  ACTIVE: '#22c55e',
  /** Trialing — subscription is in a free trial period before first billing. */
  TRIALING: '#3b82f6',
  /** Paused — subscription temporarily halted at the reseller's request. */
  PAUSED: '#eab308',
  /** Past Due — payment failed but subscription not yet cancelled; grace period. */
  PAST_DUE: '#f97316',
  /** Cancelled — subscription terminated either by reseller or automatically. */
  CANCELLED: '#ef4444',
  /** Expired — subscription reached its end date without renewal. */
  EXPIRED: '#6b7280',
};

/** i18n key mapping for subscription status labels. */
const STATUS_I18N_KEYS: Record<string, string> = {
  ACTIVE: 'dashboard.chartStatusActive',
  TRIALING: 'dashboard.chartStatusTrialing',
  PAUSED: 'dashboard.chartStatusPaused',
  PAST_DUE: 'dashboard.chartStatusPastDue',
  CANCELLED: 'dashboard.chartStatusCancelled',
  EXPIRED: 'dashboard.chartStatusExpired',
};

/** Shape of the billing dashboard data returned by the query. */
interface DashboardData {
  mrr: string;
  activeSubscriptions: number;
  churnedLast30Days: number;
  churnRate: number;
  overdueInvoiceCount: number;
  subscriptionsByStatus: Record<string, number>;
}

interface DashboardQueryData {
  resellerBillingDashboard: DashboardData;
}

const DASHBOARD_QUERY = gql`
  query ResellerBillingDashboard {
    resellerBillingDashboard {
      mrr
      activeSubscriptions
      churnedLast30Days
      churnRate
      overdueInvoiceCount
      subscriptionsByStatus
    }
  }
`;

/**
 * Formats a paise amount into Indian shorthand (Cr / L) or Indian-locale currency.
 * Values >= 1 Crore display as "₹X.XCr", >= 1 Lakh as "₹X.XL", otherwise "₹X,XXX".
 */
function formatIndianCurrency(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 1_00_00_000) {
    return `₹${(rupees / 1_00_00_000).toFixed(1)}Cr`;
  }
  if (rupees >= 1_00_000) {
    return `₹${(rupees / 1_00_000).toFixed(1)}L`;
  }
  return `₹${rupees.toLocaleString('en-IN')}`;
}

export default function BillingDashboardPage() {
  const t = useTranslations('billing');
  const { data, loading } = useQuery<DashboardQueryData>(DASHBOARD_QUERY);

  const dashboard = data?.resellerBillingDashboard;

  const statusBreakdown = (dashboard?.subscriptionsByStatus ?? {}) as Record<string, number>;

  /** Transform status breakdown into Recharts-compatible data with translated labels. */
  const pieData = useMemo(
    () =>
      Object.entries(statusBreakdown)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({
          name: STATUS_I18N_KEYS[status] ? t(STATUS_I18N_KEYS[status]) : status,
          value: count,
          color: STATUS_COLORS[status] ?? '#6b7280',
        })),
    [statusBreakdown, t],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const mrrPaise = Number(dashboard?.mrr ?? 0);
  const activeSubscriptions = Number(dashboard?.activeSubscriptions ?? 0);
  const churnRate = Number(dashboard?.churnRate ?? 0);
  const overdueCount = Number(dashboard?.overdueInvoiceCount ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('dashboard.description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.mrr')}</CardTitle>
            <IndianRupee className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatIndianCurrency(mrrPaise)}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.mrrDescription')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.activeSubscriptions')}
            </CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.churnRate')}</CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(churnRate * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.churnDescription')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.overdueInvoices')}</CardTitle>
            <AlertTriangle className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overdueCount}</div>
            {overdueCount > 0 && (
              <Badge variant="destructive" className="mt-1">
                {t('dashboard.actionRequired')}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Subscription status pie chart */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.subscriptionBreakdown')}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {Object.entries(statusBreakdown).map(([status, count]) => (
                  <div key={status} className="flex items-center gap-2">
                    <Badge variant={status === 'ACTIVE' ? 'default' : 'secondary'}>{status}</Badge>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue trend — placeholder until API returns historical data */}
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.revenueTrend')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="size-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                {t('dashboard.revenueTrendComingSoon')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
