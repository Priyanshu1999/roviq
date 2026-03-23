'use client';

import { useFormatDate, useI18nField } from '@roviq/i18n';
import {
  Badge,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@roviq/ui';
import { Check, Clock, Copy, ExternalLink, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import type { AuditLogNode } from './use-audit-logs';

interface AuditLogDetailProps {
  log: AuditLogNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACTION_TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  CREATE: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  UPDATE: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  DELETE: {
    bg: 'bg-red-500/10 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
  RESTORE: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  ASSIGN: {
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-400',
    dot: 'bg-violet-500',
  },
  REVOKE: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    text: 'text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  /** Entity suspended (still exists but disabled) */
  SUSPEND: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/15',
    text: 'text-orange-700 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  /** Suspended entity re-activated */
  ACTIVATE: {
    bg: 'bg-teal-500/10 dark:bg-teal-500/15',
    text: 'text-teal-700 dark:text-teal-400',
    dot: 'bg-teal-500',
  },
};

function getActionTypeStyle(actionType: string) {
  return ACTION_TYPE_STYLES[actionType] ?? ACTION_TYPE_STYLES.UPDATE;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Fallback for non-HTTPS or denied clipboard permissions
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex shrink-0 items-center rounded-sm p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
      title={label}
    >
      {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
    </button>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pb-2 pt-5">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
        {children}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

function FieldRow({
  label,
  children,
  mono,
  copyValue,
  copyLabel,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  copyValue?: string;
  copyLabel?: string;
}) {
  return (
    <div className="group grid grid-cols-[120px_1fr] gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40">
      <span className="text-xs text-muted-foreground pt-0.5">{label}</span>
      <div className="flex min-w-0 items-center gap-1 overflow-hidden">
        <span className={`min-w-0 truncate text-sm ${mono ? 'font-mono text-xs' : ''}`}>
          {children}
        </span>
        {copyValue && (
          <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
            <CopyButton value={copyValue} label={copyLabel ?? label} />
          </span>
        )}
      </div>
    </div>
  );
}

function NameWithId({ name, id }: { name: string | null; id: string }) {
  if (name) {
    return (
      <span className="flex items-baseline gap-1.5 overflow-hidden">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {id.slice(0, 8)}
        </span>
      </span>
    );
  }
  return <span className="font-mono text-xs">{id}</span>;
}

function JsonBlock({
  data,
  emptyMessage,
}: {
  data: Record<string, unknown> | null;
  emptyMessage: string;
}) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="mt-1.5 rounded-lg border border-dashed border-border/50 px-3 py-3">
        <span className="text-xs italic text-muted-foreground/50">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <pre className="mt-1.5 max-h-[240px] overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed text-foreground/80">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function AuditLogDetail({ log, open, onOpenChange }: AuditLogDetailProps) {
  const t = useTranslations('auditLogs');
  const { format } = useFormatDate();
  const formatDate = (date: Date) => format(date, 'dd MMM yyyy, HH:mm:ss');
  const ti = useI18nField();
  if (!log) return null;

  const style = getActionTypeStyle(log.actionType);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[480px] flex-col overflow-hidden p-0 sm:max-w-[480px]">
        <SheetHeader className="sr-only">
          <SheetTitle>{t('detail.title')}</SheetTitle>
          <SheetDescription>{t('detail.description')}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 pb-6 pt-8">
            {/* Hero: Action + Type + Entity */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge
                  className={`${style.bg} ${style.text} border-0 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide`}
                >
                  <span className={`me-1.5 size-1.5 shrink-0 rounded-full ${style.dot}`} />
                  {t(`actionTypes.${log.actionType}`)}
                </Badge>
                <Badge variant="outline" className="px-1.5 text-[11px] font-normal">
                  {log.source}
                </Badge>
              </div>

              <h2 className="font-mono text-xl font-semibold tracking-tight">{log.action}</h2>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span>{log.entityType}</span>
                {log.entityId && (
                  <>
                    <span className="text-border">·</span>
                    <span className="truncate font-mono text-xs">{log.entityId}</span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <Clock className="size-3 shrink-0" />
                <time>{formatDate(new Date(log.createdAt))}</time>
              </div>
            </div>

            {/* Impersonation warning */}
            {log.impersonatorId && (
              <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
                <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                    {t('detail.impersonated')}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-amber-600/70 dark:text-amber-400/60">
                    {log.impersonatorId}
                  </span>
                </div>
                <CopyButton value={log.impersonatorId} label={t('detail.impersonatorId')} />
              </div>
            )}

            {/* Identity Section */}
            <SectionHeader>{t('detail.sections.identity')}</SectionHeader>
            <div>
              <FieldRow label={t('detail.actorId')} copyValue={log.actorId}>
                <NameWithId name={log.actorName} id={log.actorId} />
              </FieldRow>
              <FieldRow label={t('detail.userId')} copyValue={log.userId}>
                <NameWithId name={log.userName} id={log.userId} />
              </FieldRow>
              {log.tenantId && (
                <FieldRow label={t('detail.tenantId')} copyValue={log.tenantId}>
                  <NameWithId name={ti(log.tenantName)} id={log.tenantId} />
                </FieldRow>
              )}
            </div>

            {/* Request Context Section */}
            <SectionHeader>{t('detail.sections.request')}</SectionHeader>
            <div>
              <div className="group grid grid-cols-[120px_1fr] gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40">
                <span className="text-xs text-muted-foreground pt-0.5">
                  {t('detail.correlationId')}
                </span>
                <div className="flex items-center gap-1 overflow-hidden">
                  <Link
                    href={`/audit-logs/trace/${log.correlationId}`}
                    className="inline-flex items-center gap-1 overflow-hidden font-mono text-xs text-blue-600 underline-offset-2 transition-colors hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <span className="truncate">{log.correlationId}</span>
                    <ExternalLink className="size-3 shrink-0" />
                  </Link>
                  <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <CopyButton value={log.correlationId} label={t('detail.correlationId')} />
                  </span>
                </div>
              </div>
              <FieldRow label={t('detail.source')}>{log.source}</FieldRow>
              <FieldRow label={t('detail.ipAddress')} mono copyValue={log.ipAddress ?? undefined}>
                {log.ipAddress ?? '—'}
              </FieldRow>
              <FieldRow label={t('detail.userAgent')}>{log.userAgent ?? '—'}</FieldRow>
            </div>

            {/* Changes Section */}
            <SectionHeader>{t('detail.changes')}</SectionHeader>
            <JsonBlock data={log.changes} emptyMessage={t('detail.noChanges')} />

            {/* Metadata Section */}
            <SectionHeader>{t('detail.metadata')}</SectionHeader>
            <JsonBlock data={log.metadata} emptyMessage={t('detail.noMetadata')} />

            {/* Footer: Event ID */}
            <div className="mt-6 grid grid-cols-[40px_1fr] items-center gap-2 rounded-lg bg-muted/30 px-3 py-2.5">
              <span className="text-[11px] text-muted-foreground/60">{t('detail.id')}</span>
              <div className="flex items-center gap-1 overflow-hidden justify-end">
                <span className="truncate font-mono text-[11px] text-muted-foreground/50">
                  {log.id}
                </span>
                <CopyButton value={log.id} label={t('detail.id')} />
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
