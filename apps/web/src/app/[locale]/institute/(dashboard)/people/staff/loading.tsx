import { Skeleton } from '@roviq/ui';

/**
 * Next.js route-level loading shell for the staff feature. Renders while
 * the server component tree is streaming the list or detail page. Kept
 * intentionally minimal — the skeleton shapes match the list layout (header,
 * toolbar, 8 rows) and gracefully degrade into the detail layout if the
 * user is navigating to a child route.
 */
export default function StaffLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
