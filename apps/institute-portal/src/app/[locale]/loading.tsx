import { Skeleton } from '@roviq/ui';

export default function Loading() {
  return (
    <div className="flex h-screen">
      {/* Sidebar shimmer */}
      <div className="hidden w-64 flex-col gap-4 border-r p-4 md:flex">
        <Skeleton className="h-8 w-32" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
      </div>

      {/* Main content shimmer */}
      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center border-b px-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="ml-auto h-8 w-8 rounded-full" />
        </div>
        <div className="flex-1 space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
            <Skeleton className="h-28 rounded-lg" />
          </div>
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
