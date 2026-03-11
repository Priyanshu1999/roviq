'use client';

import {
  Badge,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@roviq/ui';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { AuditLogNode } from './use-audit-logs';

interface AuditLogDetailProps {
  log: AuditLogNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
  formatDate: (date: Date) => string;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm break-all">{children}</span>
    </div>
  );
}

function JsonBlock({
  data,
  emptyMessage,
}: {
  data: Record<string, unknown> | null;
  emptyMessage: string;
}) {
  if (!data || Object.keys(data).length === 0) {
    return <span className="text-sm text-muted-foreground">{emptyMessage}</span>;
  }

  return (
    <pre className="mt-1 rounded-md bg-muted p-3 text-xs overflow-auto max-h-[300px]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function AuditLogDetail({ log, open, onOpenChange, t, formatDate }: AuditLogDetailProps) {
  if (!log) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {t('detail.title')}
            {log.impersonatorId && <Badge variant="destructive">{t('detail.impersonated')}</Badge>}
          </SheetTitle>
          <SheetDescription>{t('detail.description')}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="space-y-1 pt-4">
            <DetailRow label={t('detail.id')}>
              <span className="font-mono text-xs">{log.id}</span>
            </DetailRow>
            <DetailRow label={t('detail.createdAt')}>
              {formatDate(new Date(log.createdAt))}
            </DetailRow>

            <Separator className="my-2" />

            <DetailRow label={t('detail.action')}>{log.action}</DetailRow>
            <DetailRow label={t('detail.actionType')}>
              <Badge variant="outline">{log.actionType}</Badge>
            </DetailRow>
            <DetailRow label={t('detail.entityType')}>{log.entityType}</DetailRow>
            <DetailRow label={t('detail.entityId')}>
              {log.entityId ? <span className="font-mono text-xs">{log.entityId}</span> : '—'}
            </DetailRow>

            <Separator className="my-2" />

            <DetailRow label={t('detail.tenantId')}>
              <span className="font-mono text-xs">{log.tenantId}</span>
            </DetailRow>
            <DetailRow label={t('detail.userId')}>
              <span className="font-mono text-xs">{log.userId}</span>
            </DetailRow>
            <DetailRow label={t('detail.actorId')}>
              <span className="font-mono text-xs">{log.actorId}</span>
            </DetailRow>
            {log.impersonatorId && (
              <DetailRow label={t('detail.impersonatorId')}>
                <span className="font-mono text-xs">{log.impersonatorId}</span>
              </DetailRow>
            )}

            <Separator className="my-2" />

            <DetailRow label={t('detail.correlationId')}>
              <Link
                href={`/audit-logs/trace/${log.correlationId}`}
                className="inline-flex items-center gap-1 font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                {log.correlationId}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </Link>
              <span className="text-xs text-muted-foreground">{t('detail.viewTrace')}</span>
            </DetailRow>
            <DetailRow label={t('detail.source')}>{log.source}</DetailRow>
            <DetailRow label={t('detail.ipAddress')}>
              {log.ipAddress ? <span className="font-mono text-xs">{log.ipAddress}</span> : '—'}
            </DetailRow>
            <DetailRow label={t('detail.userAgent')}>
              {log.userAgent ? <span className="text-xs">{log.userAgent}</span> : '—'}
            </DetailRow>

            <Separator className="my-2" />

            <div className="py-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                {t('detail.changes')}
              </span>
              <JsonBlock data={log.changes} emptyMessage={t('detail.noChanges')} />
            </div>

            <div className="py-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                {t('detail.metadata')}
              </span>
              <JsonBlock data={log.metadata} emptyMessage={t('detail.noMetadata')} />
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
