import { Skeleton } from '@roviq/ui';

/**
 * Full-page skeleton for the students LIST route. Matches the real layout:
 * header row (title + action buttons), toolbar row (search + 4 select
 * filters), then a card containing 8 skeleton rows. Rendered via Next.js
 * `loading.tsx` convention while the page suspends on first load so the
 * shell appears instantly instead of a spinner wipe (rule [MYORD]).
 */
export function StudentsPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>

      <div className="rounded-md border">
        <div className="border-b p-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ms-auto h-4 w-16" />
          </div>
        </div>
        {Array.from({ length: 8 }).map((_, rowIdx) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows, stable index
            key={rowIdx}
            className="border-b p-3 last:border-b-0"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ms-auto h-4 w-16" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-2 py-4">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
    </div>
  );
}

/**
 * Full-page skeleton for the student DETAIL route. Matches the real layout:
 * back link + title + action buttons, then a tab list skeleton, then a
 * content card skeleton. Rendered via Next.js `loading.tsx` while the page
 * suspends on first load (rule [MYORD]).
 */
export function StudentDetailPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      <div className="flex gap-2 border-b">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="space-y-4 rounded-md border p-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
