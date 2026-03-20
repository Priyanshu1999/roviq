'use client';

import { useFormatDate, useFormatNumber } from '@roviq/i18n';
import {
  Button,
  Can,
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { Receipt, SearchX, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryStates } from 'nuqs';
import * as React from 'react';
import { createInvoiceColumns } from './invoice-columns';
import { InvoiceDetail } from './invoice-detail';
import { type InvoiceNode, useInvoices } from './use-invoices';

const STATUSES = ['PAID', 'PENDING', 'OVERDUE', 'FAILED', 'REFUNDED'] as const;

const filterParsers = {
  status: parseAsString,
};

export default function InvoicesPage() {
  const t = useTranslations('billing');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const [filters, setFilters] = useQueryStates(filterParsers);
  const [selectedInvoice, setSelectedInvoice] = React.useState<InvoiceNode | null>(null);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  const queryFilter = React.useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filters.status) f.status = filters.status;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filters]);

  const { invoices, totalCount, hasNextPage, loading, loadMore } = useInvoices({
    filter: queryFilter as Parameters<typeof useInvoices>[0]['filter'],
    first: 20,
  });

  const formatDate = React.useCallback((date: Date) => format(date, 'dd MMM yyyy'), [format]);

  const formatCurrency = React.useCallback((amount: number) => currency(amount), [currency]);

  const columns = React.useMemo(
    () => createInvoiceColumns(t, formatDate, formatCurrency),
    [t, formatDate, formatCurrency],
  );

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('invoices.title')}</h1>
        <p className="text-muted-foreground">{t('invoices.description')}</p>
      </div>

      <Can I="read" a="Invoice" passThrough>
        {(allowed: boolean) =>
          allowed ? (
            <>
              <DataTableToolbar>
                <div className="relative">
                  <Select
                    value={filters.status ?? ''}
                    onValueChange={(v) => setFilters({ status: v || null })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder={t('invoices.filters.status')} />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`invoices.statuses.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {filters.status && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-7 top-1/2 size-5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setFilters({ status: null })}
                    >
                      <X className="size-3" />
                    </Button>
                  )}
                </div>

                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={() => setFilters({ status: null })}>
                    <X className="mr-1 size-4" />
                    {t('invoices.filters.clearFilters')}
                  </Button>
                )}
              </DataTableToolbar>

              <DataTable
                columns={columns}
                data={invoices}
                isLoading={loading && invoices.length === 0}
                emptyMessage={t('invoices.empty')}
                onRowClick={setSelectedInvoice}
              />

              <DataTablePagination
                hasNextPage={hasNextPage}
                isLoadingMore={isLoadingMore}
                onLoadMore={handleLoadMore}
                totalCount={totalCount}
                currentCount={invoices.length}
                labels={{
                  loadMore: t('pagination.loadMore'),
                  showing: t('pagination.showing'),
                  of: t('pagination.of'),
                }}
              />

              <InvoiceDetail
                invoice={selectedInvoice}
                open={selectedInvoice !== null}
                onOpenChange={(open) => {
                  if (!open) setSelectedInvoice(null);
                }}
              />
            </>
          ) : (
            <div className="flex h-[50vh] items-center justify-center">
              <p className="text-muted-foreground">{t('invoices.accessDenied')}</p>
            </div>
          )
        }
      </Can>
    </div>
  );
}
