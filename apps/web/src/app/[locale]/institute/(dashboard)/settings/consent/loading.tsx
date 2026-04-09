import { Skeleton } from '@roviq/ui';

export default function ConsentLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );
}
