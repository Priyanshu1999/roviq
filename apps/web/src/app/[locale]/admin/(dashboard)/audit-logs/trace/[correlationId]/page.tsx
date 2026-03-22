'use client';

import { useFormatDate } from '@roviq/i18n';
import { Badge, Button, Can, Separator } from '@roviq/ui';
import { ArrowLeft, Check, ClipboardCopy } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { type AuditLogNode, useAuditLogs } from '../../use-audit-logs';

const ACTION_TYPE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  CREATE: 'default',
  UPDATE: 'secondary',
  DELETE: 'destructive',
  RESTORE: 'outline',
  ASSIGN: 'default',
  REVOKE: 'destructive',
};

export default function CorrelationTracePage() {
  const params = useParams<{ correlationId: string }>();
  const correlationId = params.correlationId;
  const t = useTranslations('auditLogs');
  const { format } = useFormatDate();
  const [copied, setCopied] = React.useState(false);

  const { logs, totalCount, loading } = useAuditLogs({
    filter: { correlationId },
    first: 100,
  });

  const sortedLogs = React.useMemo(
    () =>
      [...logs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [logs],
  );

  const firstTimestamp = sortedLogs.length > 0 ? new Date(sortedLogs[0].createdAt).getTime() : 0;
  const lastTimestamp =
    sortedLogs.length > 1
      ? new Date(sortedLogs[sortedLogs.length - 1].createdAt).getTime()
      : firstTimestamp;
  const durationMs = lastTimestamp - firstTimestamp;

  const formatDate = React.useCallback(
    (date: Date) => format(date, 'dd MMM yyyy, HH:mm:ss.SSS'),
    [format],
  );

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
  };

  const getRelativeOffset = (createdAt: string): string => {
    const offset = new Date(createdAt).getTime() - firstTimestamp;
    return `+${formatDuration(offset)}`;
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(correlationId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/audit-logs"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('trace.backToLogs')}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t('trace.title')}</h1>
        <p className="text-muted-foreground">{t('trace.description')}</p>
      </div>

      <Can I="read" a="AuditLog" passThrough>
        {(allowed: boolean) =>
          allowed ? (
            <>
              <TraceSummary
                correlationId={correlationId}
                eventCount={totalCount}
                durationMs={durationMs}
                loading={loading}
                copied={copied}
                onCopy={handleCopy}
                t={t}
                formatDuration={formatDuration}
              />

              <Separator />

              {loading && sortedLogs.length === 0 ? (
                <div className="flex h-[30vh] items-center justify-center">
                  <p className="text-muted-foreground">Loading...</p>
                </div>
              ) : sortedLogs.length === 0 ? (
                <div className="flex h-[30vh] items-center justify-center">
                  <p className="text-muted-foreground">{t('trace.emptyState')}</p>
                </div>
              ) : (
                <div className="space-y-0">
                  <h2 className="mb-4 text-lg font-semibold">{t('trace.timeline')}</h2>
                  <div className="relative ms-4">
                    {sortedLogs.map((log, index) => (
                      <TimelineEvent
                        key={log.id}
                        log={log}
                        isLast={index === sortedLogs.length - 1}
                        relativeOffset={getRelativeOffset(log.createdAt)}
                        formatDate={formatDate}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
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

function TraceSummary({
  correlationId,
  eventCount,
  durationMs,
  loading,
  copied,
  onCopy,
  t,
  formatDuration,
}: {
  correlationId: string;
  eventCount: number;
  durationMs: number;
  loading: boolean;
  copied: boolean;
  onCopy: () => void;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  formatDuration: (ms: number) => string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <span className="text-sm font-medium text-muted-foreground">
            {t('trace.correlationId')}
          </span>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-sm text-blue-600 dark:text-blue-400 break-all">
              {correlationId}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onCopy}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <ClipboardCopy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-muted-foreground">{t('trace.timeline')}</span>
          <div className="mt-1">
            {loading ? (
              <span className="text-sm text-muted-foreground">...</span>
            ) : (
              <Badge variant="secondary">{t('trace.eventCount', { count: eventCount })}</Badge>
            )}
          </div>
        </div>

        <div>
          <span className="text-sm font-medium text-muted-foreground">{t('trace.duration')}</span>
          <div className="mt-1">
            {loading ? (
              <span className="text-sm text-muted-foreground">...</span>
            ) : (
              <span className="text-sm font-medium">{formatDuration(durationMs)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineEvent({
  log,
  isLast,
  relativeOffset,
  formatDate,
  t,
}: {
  log: AuditLogNode;
  isLast: boolean;
  relativeOffset: string;
  formatDate: (date: Date) => string;
  t: (key: string) => string;
}) {
  const variant = ACTION_TYPE_VARIANT[log.actionType] ?? 'secondary';

  return (
    <div className="relative pb-6">
      {/* Vertical connector line */}
      {!isLast && <div className="absolute left-[7px] top-[18px] h-full w-px bg-border" />}

      <div className="flex gap-4">
        {/* Timeline dot */}
        <div className="relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-primary bg-background" />

        {/* Event content */}
        <div className="min-w-0 flex-1 rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={variant}>{log.actionType}</Badge>
            <span className="font-medium">{log.action}</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">
              {relativeOffset}
            </span>
          </div>

          <div className="mt-2 grid gap-1 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('detail.entityType')}:</span>
              <span>{log.entityType}</span>
              {log.entityId && (
                <>
                  <span className="text-muted-foreground">{t('detail.entityId')}:</span>
                  <span className="font-mono text-xs">{log.entityId.slice(0, 8)}</span>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('trace.actor')}:</span>
              {log.actorName ? (
                <>
                  <span className="text-sm">{log.actorName}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {log.actorId.slice(0, 8)}
                  </span>
                </>
              ) : (
                <span className="font-mono text-xs">{log.actorId.slice(0, 8)}</span>
              )}
              {log.impersonatorId && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  {t('detail.impersonated')}
                </Badge>
              )}
            </div>

            <div className="flex gap-2">
              <span className="text-muted-foreground">{t('detail.source')}:</span>
              <span>{log.source}</span>
            </div>

            <div className="text-xs text-muted-foreground">
              {formatDate(new Date(log.createdAt))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
