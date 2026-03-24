'use client';

import { gql, useQuery } from '@roviq/graphql';
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@roviq/ui';
import { AlertTriangle, IndianRupee, TrendingUp, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
  const statusBreakdown = (dashboard?.subscriptionsByStatus ?? {}) as Record<string, number>;

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

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.subscriptionBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusBreakdown).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <Badge variant={status === 'ACTIVE' ? 'default' : 'secondary'}>{status}</Badge>
                <span className="text-sm font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
