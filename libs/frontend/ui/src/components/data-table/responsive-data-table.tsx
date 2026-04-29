'use client';

import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { Card } from '../ui/card';
import { DataTable, type DataTableProps } from './data-table';

export interface ResponsiveDataTableProps<TData> extends DataTableProps<TData> {
  /**
   * Optional render prop for the mobile (below `sm`) breakpoint. When
   * provided, rows are rendered as a stacked vertical list of `<Card>`s
   * instead of a table on small viewports. Each card's content is whatever
   * this function returns for the row. When omitted, the regular
   * `<DataTable>` renders at every breakpoint.
   *
   * Both renderings stay in the DOM and are toggled with Tailwind
   * responsive classes (`hidden sm:block` / `sm:hidden block`) so this is
   * SSR-safe and avoids JS-driven viewport detection.
   */
  mobileCard?: (row: TData) => ReactNode;
}

export function ResponsiveDataTable<TData>({
  mobileCard,
  ...dataTableProps
}: ResponsiveDataTableProps<TData>) {
  const {
    columns,
    data,
    isLoading,
    emptyMessage,
    emptyState,
    onRowClick,
    skeletonRows = 0,
  } = dataTableProps;

  // Build a parallel TanStack table only to obtain stable row ids that
  // match the desktop `<DataTable>` rendering. Cheap because rows are
  // already in memory and we're not subscribing to any state.
  const mobileTable = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!mobileCard) {
    return (
      <div data-testid="responsive-data-table">
        <DataTable {...dataTableProps} />
      </div>
    );
  }

  const rows = mobileTable.getRowModel().rows;
  const showSkeleton = isLoading && skeletonRows > 0 && data.length === 0;
  const showSpinner = isLoading && !showSkeleton;

  return (
    <div data-testid="responsive-data-table">
      {/* Desktop: regular table at sm+ */}
      <div className="hidden sm:block">
        <DataTable {...dataTableProps} />
      </div>

      {/* Mobile: stacked card list below sm */}
      <div className="block sm:hidden space-y-3" data-testid="responsive-data-table-mobile">
        {showSpinner ? (
          <Card className="p-4">
            <div className="flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </Card>
        ) : showSkeleton ? (
          Array.from({ length: skeletonRows }).map((_, index) => (
            <Card
              key={`responsive-skeleton-${index}`}
              className="p-4"
              data-testid={`responsive-data-table-skeleton-${index}`}
            >
              <div className="space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded-md bg-muted" />
              </div>
            </Card>
          ))
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <Card
              key={row.id}
              className={`p-4${onRowClick ? ' cursor-pointer' : ''}`}
              data-testid={`responsive-data-table-card-${row.id}`}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            >
              {mobileCard(row.original)}
            </Card>
          ))
        ) : emptyState ? (
          <Card className="p-4">{emptyState}</Card>
        ) : (
          <Card className="p-4 text-center text-muted-foreground">
            {emptyMessage ?? 'No results.'}
          </Card>
        )}
      </div>
    </div>
  );
}
