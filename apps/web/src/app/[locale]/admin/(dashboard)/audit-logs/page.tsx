'use client';

import { useFormatDate } from '@roviq/i18n';
import {
  Button,
  Can,
  DataTable,
  DataTablePagination,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@roviq/ui';
import { ScrollText, SearchX, ShieldAlert, Users, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { createAuditLogColumns } from './audit-log-columns';
import { AuditLogDetail } from './audit-log-detail';
import { AuditLogFilters, useAuditLogFilters } from './audit-log-filters';
import { type AuditLogNode, useAuditLogs } from './use-audit-logs';

const { adminAuditLogs } = testIds;
type AuditTab = 'all' | 'impersonation' | 'reseller';

export default function AuditLogsPage() {
  const t = useTranslations('auditLogs');
  const { format } = useFormatDate();
  const [filters, setFilters] = useAuditLogFilters();
  const [selectedLog, setSelectedLog] = React.useState<AuditLogNode | null>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [activeTab, setActiveTab] = useQueryState('tab', parseAsString.withDefault('all'));
  const hasFilters = Object.values(filters).some(Boolean);

  const queryFilter = React.useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filters.entityType) f.entityType = filters.entityType;
    if (filters.actionType) f.actionTypes = [filters.actionType];
    if (filters.userId) f.userId = filters.userId;

    // Tab-specific preset filters
    if (activeTab === 'impersonation') {
      f.impersonatedOnly = true;
    } else if (activeTab === 'reseller') {
      f.scopes = ['RESELLER'];
    }

    return Object.keys(f).length > 0 ? f : undefined;
  }, [filters, activeTab]);

  const { logs, totalCount, hasNextPage, loading, loadMore } = useAuditLogs({
    filter: queryFilter as Parameters<typeof useAuditLogs>[0]['filter'],
    first: 20,
  });

  const formatDate = React.useCallback(
    (date: Date) => format(date, 'dd MMM yyyy, HH:mm:ss'),
    [format],
  );

  const columns = React.useMemo(() => createAuditLogColumns(t, formatDate), [t, formatDate]);

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as AuditTab);
  };

  return (
    <div className="space-y-4" data-testid={adminAuditLogs.page}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid={adminAuditLogs.title}>
          {t('title')}
        </h1>
        <p className="text-muted-foreground" data-testid={adminAuditLogs.description}>
          {t('description')}
        </p>
      </div>

      <Can I="read" a="AuditLog" passThrough>
        {(allowed: boolean) =>
          allowed ? (
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList>
                <TabsTrigger value="all" data-testid={adminAuditLogs.tabAll}>
                  <ScrollText className="me-1.5 size-4" />
                  {t('tabs.all')}
                </TabsTrigger>
                <TabsTrigger value="impersonation" data-testid={adminAuditLogs.tabImpersonation}>
                  <ShieldAlert className="me-1.5 size-4" />
                  {t('tabs.impersonation')}
                </TabsTrigger>
                <TabsTrigger value="reseller" data-testid={adminAuditLogs.tabReseller}>
                  <Users className="me-1.5 size-4" />
                  {t('tabs.resellerActivity')}
                </TabsTrigger>
              </TabsList>

              {/* All three tabs share the same content — only the filter preset changes */}
              <TabsContent value={activeTab} forceMount className="mt-4 space-y-4">
                <AuditLogFilters />

                <DataTable
                  data-testid={adminAuditLogs.table}
                  columns={columns}
                  data={logs}
                  isLoading={loading && logs.length === 0}
                  emptyState={
                    hasFilters || activeTab !== 'all' ? (
                      <Empty className="py-12">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <SearchX />
                          </EmptyMedia>
                          <EmptyTitle>{t('emptyFilteredTitle')}</EmptyTitle>
                          <EmptyDescription>{t('emptyFilteredDescription')}</EmptyDescription>
                        </EmptyHeader>
                        {hasFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setFilters({ entityType: null, actionType: null, userId: null })
                            }
                          >
                            <X className="me-1 size-4" />
                            {t('filters.clearFilters')}
                          </Button>
                        )}
                      </Empty>
                    ) : (
                      <Empty className="py-12">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <ScrollText />
                          </EmptyMedia>
                          <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
                          <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    )
                  }
                  onRowClick={setSelectedLog}
                />

                <DataTablePagination
                  hasNextPage={hasNextPage}
                  isLoadingMore={isLoadingMore}
                  onLoadMore={handleLoadMore}
                  totalCount={totalCount}
                  currentCount={logs.length}
                  labels={{
                    loadMore: t('pagination.loadMore'),
                    showing: t('pagination.showing'),
                    of: t('pagination.of'),
                  }}
                />

                <AuditLogDetail
                  log={selectedLog}
                  open={selectedLog !== null}
                  onOpenChange={(open) => {
                    if (!open) setSelectedLog(null);
                  }}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex h-[50vh] items-center justify-center">
              <p className="text-muted-foreground">{t('accessDenied')}</p>
            </div>
          )
        }
      </Can>
    </div>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
