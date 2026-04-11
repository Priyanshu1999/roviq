'use client';

import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  /** @deprecated Use `emptyState` instead for contextual empty states */
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  'data-test-id'?: string;
  /**
   * When true, the first column is `sticky left-0` with a subtle inset
   * shadow on its right edge. Used for selection/checkbox columns that
   * must stay visible while the rest of the table scrolls horizontally.
   * Implements rule [IXABI] from frontend-ux. Defaults to false.
   */
  stickyFirstColumn?: boolean;
  /**
   * When true, the LAST column is `sticky right-0` with an inset shadow
   * on its left edge. Used for action/menu columns. Defaults to false.
   */
  stickyLastColumn?: boolean;
  /**
   * Number of skeleton rows to render while `isLoading=true` and `data`
   * is empty. Replaces the single-spinner loading state with rows that
   * match the actual table layout, per rule [IMUXO]. Each cell renders
   * a `<Skeleton>` from this same library. Set to 0 (default) to keep
   * the existing spinner-row behaviour.
   */
  skeletonRows?: number;
}

const STICKY_FIRST_CLASS =
  'sticky left-0 z-10 bg-background shadow-[inset_-1px_0_0_0_hsl(var(--border))]';
const STICKY_LAST_CLASS =
  'sticky right-0 z-10 bg-background shadow-[inset_1px_0_0_0_hsl(var(--border))]';

function stickyClassFor(
  index: number,
  lastIndex: number,
  stickyFirst: boolean,
  stickyLast: boolean,
): string | undefined {
  if (stickyFirst && index === 0) return STICKY_FIRST_CLASS;
  if (stickyLast && index === lastIndex) return STICKY_LAST_CLASS;
  return undefined;
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  emptyMessage,
  emptyState,
  onRowClick,
  stickyFirstColumn = false,
  stickyLastColumn = false,
  skeletonRows = 0,
  'data-test-id': dataTestId,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const lastColumnIndex = columns.length - 1;
  const showSkeletonRows = isLoading && skeletonRows > 0 && data.length === 0;

  return (
    <div className="rounded-md border overflow-x-auto" data-test-id={dataTestId}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header, headerIndex) => (
                <TableHead
                  key={header.id}
                  data-test-id={dataTestId ? `${dataTestId}-col-${header.id}` : undefined}
                  className={stickyClassFor(
                    headerIndex,
                    lastColumnIndex,
                    stickyFirstColumn,
                    stickyLastColumn,
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading && !showSkeletonRows ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <div className="flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              </TableCell>
            </TableRow>
          ) : showSkeletonRows ? (
            Array.from({ length: skeletonRows }).map((_, rowIndex) => (
              <TableRow key={`skeleton-row-${rowIndex}`}>
                {columns.map((_col, cellIndex) => (
                  <TableCell
                    key={`skeleton-cell-${rowIndex}-${cellIndex}`}
                    className={stickyClassFor(
                      cellIndex,
                      lastColumnIndex,
                      stickyFirstColumn,
                      stickyLastColumn,
                    )}
                  >
                    <Skeleton className="h-4 w-3/4" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? 'selected' : undefined}
                className={onRowClick ? 'cursor-pointer' : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell, cellIndex) => (
                  <TableCell
                    key={cell.id}
                    className={stickyClassFor(
                      cellIndex,
                      lastColumnIndex,
                      stickyFirstColumn,
                      stickyLastColumn,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : emptyState ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="p-0">
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {emptyMessage ?? 'No results.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
