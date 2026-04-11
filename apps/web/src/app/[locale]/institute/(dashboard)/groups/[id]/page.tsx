'use client';

import type { GroupMembershipType } from '@roviq/graphql/generated';
import {
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EntityTimeline,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useBreadcrumbOverride,
} from '@roviq/ui';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  LucideUsers,
  Play,
  RefreshCw,
  Settings2,
  Shuffle,
  Zap,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import {
  type GroupRule,
  type RulePreviewResult,
  useGroup,
  useGroupMembers,
  useGroupMembershipResolvedSubscription,
  usePreviewGroupRule,
  useResolveGroupMembers,
  useSetGroupMemberExcluded,
  useUpdateGroup,
} from '../use-groups';

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hh}:${mm}`;
}

const MEMBERSHIP_TYPE_ICON: Record<
  GroupMembershipType,
  React.ComponentType<{ className?: string }>
> = {
  STATIC: LucideUsers,
  DYNAMIC: Zap,
  HYBRID: Shuffle,
};

const MEMBERSHIP_TYPE_CLASS: Record<GroupMembershipType, string> = {
  STATIC: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  DYNAMIC: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  HYBRID: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

export default function GroupDetailPage() {
  const t = useTranslations('groups');
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, loading, refetch } = useGroup(id);
  const group = data?.getGroup ?? null;

  useBreadcrumbOverride(group ? { [id]: group.name } : {});

  const [resolveGroupMembers, { loading: resolving }] = useResolveGroupMembers();

  // Live subscription: flip the indicator on, refetch the group query on
  // every received `groupMembershipResolved` event (member count + resolvedAt
  // update without the user pressing Refresh).
  const [isLive, setIsLive] = React.useState(false);
  useGroupMembershipResolvedSubscription(id, () => {
    setIsLive(true);
    refetch();
  });

  const handleResolve = async () => {
    try {
      await resolveGroupMembers({ variables: { groupId: id } });
      toast.success(t('detail.resolveSuccess'));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('detail.resolveError'));
    }
  };

  if (loading && !group) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/institute/groups')}>
          <ArrowLeft className="size-4" />
          {t('detail.back')}
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto size-12 text-muted-foreground" />
            <p className="mt-4 font-medium">{t('detail.notFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDynamic = group.membershipType === 'DYNAMIC';
  const isHybrid = group.membershipType === 'HYBRID';
  const showRulesTab = isDynamic || isHybrid;

  const MembershipIcon = MEMBERSHIP_TYPE_ICON[group.membershipType] ?? LucideUsers;

  return (
    <Can I="read" a="Group" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between print:hidden">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/institute/groups')}
                  className="mb-2"
                  data-test-id="groups-detail-back-btn"
                >
                  <ArrowLeft className="size-4" />
                  {t('detail.back')}
                </Button>
                <div className="flex items-center gap-3">
                  <h1
                    className="text-2xl font-bold tracking-tight"
                    data-test-id="groups-detail-title"
                  >
                    {group.name}
                  </h1>
                  <Badge variant="secondary" data-test-id="groups-detail-type-badge">
                    <Settings2 className="size-3.5" />
                    {t(`types.${group.groupType}`, { default: group.groupType })}
                  </Badge>
                  <Badge
                    variant="secondary"
                    data-test-id="groups-detail-membership-badge"
                    className={`inline-flex items-center gap-1 ${
                      MEMBERSHIP_TYPE_CLASS[group.membershipType] ?? ''
                    }`}
                  >
                    <MembershipIcon className="size-3.5" />
                    {t(`membershipTypes.${group.membershipType}`, {
                      default: group.membershipType,
                    })}
                  </Badge>
                </div>
                {group.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                )}
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="size-3.5" />
                  {t('detail.lastResolvedAt', { at: formatDateTime(group.resolvedAt) })}
                </p>
              </div>

              {showRulesTab && (
                <Can I="update" a="Group">
                  <div className="flex items-center gap-2">
                    {isLive && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                        aria-live="polite"
                      >
                        <span className="inline-block size-2 animate-pulse rounded-full bg-emerald-500" />
                        {t('detail.actions.live')}
                      </span>
                    )}
                    <Button onClick={handleResolve} disabled={resolving}>
                      <RefreshCw className={`size-4 ${resolving ? 'animate-spin' : ''}`} />
                      {resolving ? t('detail.resolving') : t('detail.resolveButton')}
                    </Button>
                  </div>
                </Can>
              )}
            </div>

            <Tabs defaultValue="members">
              <TabsList>
                <TabsTrigger value="members" data-test-id="groups-detail-tab-members">
                  {t('detail.tabs.members', { count: group.memberCount })}
                </TabsTrigger>
                {showRulesTab && (
                  <TabsTrigger value="rules" data-test-id="groups-detail-tab-rules">
                    {t('detail.tabs.rules')}
                  </TabsTrigger>
                )}
                <TabsTrigger value="audit" data-test-id="groups-detail-tab-audit">
                  {t('detail.tabs.audit')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="members">
                <MembersPanel
                  groupId={group.id}
                  memberCount={group.memberCount}
                  membershipType={group.membershipType}
                />
              </TabsContent>

              {showRulesTab && (
                <TabsContent value="rules">
                  <RulesPanel groupId={group.id} version={group.version} />
                </TabsContent>
              )}

              <TabsContent value="audit">
                <Card>
                  <CardContent className="pt-6">
                    <EntityTimeline entityType="Group" entityId={group.id} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : null
      }
    </Can>
  );
}

// ─── Members Panel ─────────────────────────────────────────────────────────

function MembersPanel({
  groupId,
  memberCount,
  membershipType,
}: {
  groupId: string;
  memberCount: number;
  membershipType: GroupMembershipType;
}) {
  const t = useTranslations('groups');
  const isHybrid = membershipType === 'HYBRID';

  const { data, loading, refetch } = useGroupMembers(groupId);
  const members = data?.listGroupMembers ?? [];

  const [setExcluded, { loading: toggling }] = useSetGroupMemberExcluded();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const handleToggleExcluded = async (memberId: string, nextExcluded: boolean) => {
    setPendingId(memberId);
    try {
      await setExcluded({
        variables: { groupId, memberId, excluded: nextExcluded },
      });
      toast.success(
        nextExcluded ? t('detail.members.excludedToast') : t('detail.members.includedToast'),
      );
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('detail.members.toggleError'));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('detail.members.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('detail.members.summary', { count: memberCount })}
            </p>
          </div>
          {isHybrid && (
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline">{t('detail.members.badgeManual')}</Badge>
              <Badge variant="outline">{t('detail.members.badgeResolved')}</Badge>
            </div>
          )}
        </div>

        {loading && members.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : members.length === 0 ? (
          <section
            aria-label={t('detail.members.listAriaLabel', { groupId })}
            className="rounded-md border p-6 text-center text-sm text-muted-foreground"
            data-test-id="groups-members-empty"
          >
            {t('detail.members.empty')}
          </section>
        ) : (
          <ul
            aria-label={t('detail.members.listAriaLabel', { groupId })}
            className="divide-y rounded-md border"
          >
            {members.map((m) => {
              const excluded = m.isExcluded;
              const isPending = pendingId === m.id && toggling;
              return (
                <li
                  key={m.id}
                  className={`flex items-center justify-between gap-4 px-4 py-3 ${
                    excluded ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {m.displayName ?? m.membershipId}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {m.source === 'MANUAL'
                          ? t('detail.members.badgeManual')
                          : m.source === 'RULE'
                            ? t('detail.members.badgeResolved')
                            : t('detail.members.badgeInherited')}
                      </Badge>
                      {excluded && (
                        <Badge variant="destructive" className="text-xs">
                          {t('detail.members.excludedBadge')}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isHybrid && (
                    <Can I="update" a="Group">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span id={`exclude-label-${m.id}`}>
                          {excluded ? t('detail.members.include') : t('detail.members.exclude')}
                        </span>
                        <Switch
                          checked={excluded}
                          disabled={isPending}
                          onCheckedChange={(checked) => handleToggleExcluded(m.id, checked)}
                          aria-labelledby={`exclude-label-${m.id}`}
                        />
                      </div>
                    </Can>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Rules Panel ───────────────────────────────────────────────────────────

function RulesPanel({ groupId, version }: { groupId: string; version: number }) {
  const t = useTranslations('groups');
  const [editOpen, setEditOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [ruleText, setRuleText] = React.useState('{}');
  const [ruleError, setRuleError] = React.useState<string | null>(null);
  const [previewResult, setPreviewResult] = React.useState<RulePreviewResult | null>(null);

  const [updateGroup, { loading: saving }] = useUpdateGroup();
  const [runPreview, { loading: previewing }] = usePreviewGroupRule();

  const parseRule = (): GroupRule | null => {
    try {
      const parsed = JSON.parse(ruleText) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setRuleError(t('detail.rules.errors.mustBeObject'));
        return null;
      }
      setRuleError(null);
      return parsed as GroupRule;
    } catch {
      setRuleError(t('detail.rules.errors.invalidJson'));
      return null;
    }
  };

  const handlePreview = async () => {
    const rule = parseRule();
    if (!rule) return;
    try {
      const result = await runPreview({ variables: { rule } });
      if (result.data) {
        setPreviewResult(result.data.previewGroupRule);
        setPreviewOpen(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('detail.rules.previewError'));
    }
  };

  const handleSave = async () => {
    const rule = parseRule();
    if (!rule) return;
    try {
      await updateGroup({ variables: { id: groupId, input: { rule } } });
      toast.success(t('detail.rules.saveSuccess'));
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('detail.rules.saveError'));
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t('detail.rules.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('detail.rules.description', { version })}
            </p>
          </div>
          <Can I="update" a="Group">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              {t('detail.rules.editButton')}
            </Button>
          </Can>
        </div>

        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs">
          {t('detail.rules.placeholderJson')}
        </pre>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('detail.rules.dialog.title')}</DialogTitle>
              <DialogDescription>{t('detail.rules.dialog.description')}</DialogDescription>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="rule-json">{t('detail.rules.dialog.ruleLabel')}</FieldLabel>
                <Textarea
                  id="rule-json"
                  rows={14}
                  value={ruleText}
                  onChange={(e) => setRuleText(e.target.value)}
                  className="font-mono text-xs"
                  placeholder='{"and": [{"==": [{"var": "gender"}, "female"]}]}'
                />
                {ruleError && <FieldError>{ruleError}</FieldError>}
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                {t('actions.cancel')}
              </Button>
              <Button type="button" variant="outline" onClick={handlePreview} disabled={previewing}>
                <Play className="size-4" />
                {previewing
                  ? t('detail.rules.dialog.previewing')
                  : t('detail.rules.dialog.preview')}
              </Button>
              <Button type="button" onClick={handleSave} disabled={saving}>
                {saving ? t('detail.rules.dialog.saving') : t('detail.rules.dialog.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t('detail.rules.previewDialog.title')}</DialogTitle>
              <DialogDescription>
                {previewResult
                  ? t('detail.rules.previewDialog.countSummary', {
                      count: previewResult.count,
                    })
                  : ''}
              </DialogDescription>
            </DialogHeader>
            {previewResult && previewResult.sampleMembershipIds.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('detail.rules.previewDialog.sampleHeading')}
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto rounded border bg-muted/30 p-3">
                  {previewResult.sampleMembershipIds.slice(0, 10).map((mid) => (
                    <li key={mid} className="font-mono text-xs">
                      {mid}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('detail.rules.previewDialog.noMatches')}
              </p>
            )}
            <DialogFooter>
              <Button onClick={() => setPreviewOpen(false)}>{t('actions.close')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
