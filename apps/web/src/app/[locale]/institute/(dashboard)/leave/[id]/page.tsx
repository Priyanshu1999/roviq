'use client';

import { useAuth } from '@roviq/auth';
import { extractGraphQLError } from '@roviq/graphql';
import { useFormatDate } from '@roviq/i18n';
import { Badge, Button, Can, Card, CardContent, CardHeader, CardTitle } from '@roviq/ui';
import { ArrowLeft, CalendarOff, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  type LeaveRecord,
  type LeaveStatus,
  useApproveLeave,
  useCancelLeave,
  useLeave,
  useRejectLeave,
} from '../use-leave';

const STATUS_COLORS: Record<LeaveStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-100 text-rose-700 border-rose-200',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
};

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export default function LeaveDetailPage() {
  const t = useTranslations('leave');
  const params = useParams();
  const id = params.id as string;

  const { leave, loading, refetch } = useLeave(id);

  return (
    <Can I="read" a="Leave" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <DetailHeader leave={leave} onChanged={refetch} />
            {loading && !leave ? (
              <Card>
                <CardContent className="p-6">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ) : leave ? (
              <LeaveDetailCard leave={leave} />
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground" data-testid="leave-detail-access-denied">
              {t('accessDenied')}
            </p>
          </div>
        )
      }
    </Can>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Header — back link + title + contextual action buttons
// ─────────────────────────────────────────────────────────────────────

function DetailHeader({
  leave,
  onChanged,
}: {
  leave: LeaveRecord | null;
  onChanged: () => Promise<unknown>;
}) {
  const t = useTranslations('leave');
  const params = useParams();
  const locale = params.locale as string;

  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-2"
          data-testid="leave-detail-back-btn"
        >
          <Link href={`/${locale}/institute/leave`}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('detail.back')}
          </Link>
        </Button>
        <h1
          className="text-2xl font-semibold tracking-tight flex items-center gap-2"
          data-testid="leave-detail-title"
        >
          <CalendarOff className="size-6 text-primary" aria-hidden="true" />
          {t('title')}
        </h1>
      </div>
      {leave ? <DetailActions leave={leave} onChanged={onChanged} /> : null}
    </header>
  );
}

function DetailActions({
  leave,
  onChanged,
}: {
  leave: LeaveRecord;
  onChanged: () => Promise<unknown>;
}) {
  const t = useTranslations('leave');
  const { user } = useAuth();
  const { approve, loading: approving } = useApproveLeave();
  const { reject, loading: rejecting } = useRejectLeave();
  const { cancel, loading: cancelling } = useCancelLeave();

  async function runAction(
    fn: (id: string, membershipId: string) => Promise<unknown>,
    key: 'approve' | 'reject' | 'cancel',
  ): Promise<void> {
    if (!user?.membershipId) return;
    try {
      await fn(leave.id, user.membershipId);
      toast.success(t(`actions.${key}`));
      await onChanged();
    } catch (err) {
      toast.error(extractGraphQLError(err, t(`actions.${key}`)));
    }
  }

  if (leave.status === 'PENDING') {
    return (
      <div className="flex items-center gap-2">
        <Can I="update" a="Leave">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => runAction(approve, 'approve')}
            disabled={approving}
            data-testid="leave-detail-approve-btn"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {approving ? t('actions.approving') : t('actions.approve')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={() => runAction(reject, 'reject')}
            disabled={rejecting}
            data-testid="leave-detail-reject-btn"
          >
            <XCircle className="size-4" aria-hidden="true" />
            {rejecting ? t('actions.rejecting') : t('actions.reject')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 text-slate-600"
            onClick={() => runAction(cancel, 'cancel')}
            disabled={cancelling}
            data-testid="leave-detail-cancel-btn"
          >
            <CalendarOff className="size-4" aria-hidden="true" />
            {cancelling ? t('actions.cancelling') : t('actions.cancel')}
          </Button>
        </Can>
      </div>
    );
  }

  if (leave.status === 'APPROVED') {
    return (
      <Can I="update" a="Leave">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 text-slate-600"
          onClick={() => runAction(cancel, 'cancel')}
          disabled={cancelling}
          data-testid="leave-detail-cancel-btn"
        >
          <CalendarOff className="size-4" aria-hidden="true" />
          {cancelling ? t('actions.cancelling') : t('actions.cancel')}
        </Button>
      </Can>
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Body — all fields
// ─────────────────────────────────────────────────────────────────────

function LeaveDetailCard({ leave }: { leave: LeaveRecord }) {
  const t = useTranslations('leave');
  const { format } = useFormatDate();

  return (
    <Card data-testid="leave-detail-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Badge variant="outline" data-testid="leave-detail-type">
              {t(`type.${leave.type}`)}
            </Badge>
            <Badge
              variant="outline"
              className={STATUS_COLORS[leave.status]}
              data-testid="leave-detail-status"
            >
              {t(`status.${leave.status}`)}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailRow label={t('fields.userId')} value={leave.userId} testId="leave-detail-user" />
        <DetailRow
          label={`${t('fields.startDate')} – ${t('fields.endDate')}`}
          value={`${format(parseIsoDateLocal(leave.startDate), 'dd MMM yyyy')} – ${format(
            parseIsoDateLocal(leave.endDate),
            'dd MMM yyyy',
          )}`}
          testId="leave-detail-dates"
        />
        <DetailRow label={t('detail.reason')} value={leave.reason} testId="leave-detail-reason" />
        {leave.fileUrls.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">{t('fields.fileUrls')}</p>
            <ul className="list-disc pl-5 space-y-0.5 text-sm" data-testid="leave-detail-file-urls">
              {leave.fileUrls.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary underline-offset-4 hover:underline break-all"
                  >
                    {url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {leave.decidedBy ? (
          <DetailRow
            label={t('detail.decidedBy')}
            value={leave.decidedBy}
            testId="leave-detail-decided-by"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm break-words" data-testid={testId}>
        {value}
      </p>
    </div>
  );
}
