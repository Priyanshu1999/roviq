'use client';

import { useFormatDate, useI18nField } from '@roviq/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Can,
  DataTable,
  DataTablePagination,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldError,
  FieldLabel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@roviq/ui';
import { testIds } from '@web/testing/testid-registry';
import { Building2, Plus, SearchX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { createApprovalColumns, createInstituteColumns } from './institute-columns';
import { InstituteFilters, useInstituteFilters } from './institute-filters';
import type { InstituteNode } from './types';
import {
  useAdminInstituteApprovalRequested,
  useAdminInstituteCreated,
  useApproveInstitute,
  useInstitutes,
  useRejectInstitute,
} from './use-institutes';

export default function InstitutesPage() {
  const t = useTranslations('adminInstitutes');
  const resolveI18n = useI18nField();
  const { formatDistance } = useFormatDate();
  const router = useRouter();
  const [activeTab, setActiveTab] = useQueryState('tab', parseAsString.withDefault('all'));
  const [filters] = useInstituteFilters();
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  // Approve/reject state
  const [approveTarget, setApproveTarget] = React.useState<InstituteNode | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<InstituteNode | null>(null);
  const [rejectReason, setRejectReason] = React.useState('');

  const [approveInstitute] = useApproveInstitute();
  const [rejectInstitute] = useRejectInstitute();

  const formatDate = React.useCallback(
    (date: Date) => formatDistance(date, new Date()),
    [formatDistance],
  );

  // Build filter for GraphQL (status is [InstituteStatus!] per schema)
  const queryFilter = React.useMemo(() => {
    const f: Record<string, unknown> = {};
    if (filters.search) f.search = filters.search;
    if (activeTab === 'pendingApproval') {
      f.status = ['PENDING_APPROVAL'];
    } else if (filters.status) {
      f.status = [filters.status];
    }
    if (filters.type) f.type = filters.type;
    if (filters.resellerId) f.resellerId = filters.resellerId;
    if (filters.groupId) f.groupId = filters.groupId;
    if (filters.state) f.state = filters.state;
    if (filters.district) f.district = filters.district;
    if (filters.board) f.affiliationBoard = filters.board;
    if (filters.createdAfter) f.createdAfter = filters.createdAfter;
    if (filters.createdBefore) f.createdBefore = filters.createdBefore;
    return Object.keys(f).length > 0 ? f : undefined;
  }, [filters, activeTab]);

  const { institutes, totalCount, hasNextPage, loading, loadMore, refetch } = useInstitutes({
    filter: queryFilter,
  });

  // Real-time: refetch on new institute or approval request so the list stays current
  const { data: createdEvent } = useAdminInstituteCreated();
  const { data: approvalEvent } = useAdminInstituteApprovalRequested();
  const lastCreatedRef = React.useRef<string | null>(null);
  const lastApprovalRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    const id = createdEvent?.adminInstituteCreated.id;
    if (id && id !== lastCreatedRef.current) {
      lastCreatedRef.current = id;
      refetch();
    }
  }, [createdEvent, refetch]);
  React.useEffect(() => {
    const id = approvalEvent?.adminInstituteApprovalRequested.id;
    if (id && id !== lastApprovalRef.current) {
      lastApprovalRef.current = id;
      refetch();
    }
  }, [approvalEvent, refetch]);

  // Pending count
  const pendingCount = React.useMemo(
    () =>
      activeTab === 'pendingApproval'
        ? totalCount
        : institutes.filter((i) => i.status === 'PENDING_APPROVAL').length,
    [institutes, totalCount, activeTab],
  );

  const columns = React.useMemo(
    () => createInstituteColumns(t, resolveI18n, formatDate),
    [t, resolveI18n, formatDate],
  );

  const approvalColumns = React.useMemo(
    () => createApprovalColumns(t, resolveI18n, formatDate, setApproveTarget, setRejectTarget),
    [t, resolveI18n, formatDate],
  );

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRowClick = (row: InstituteNode) => {
    router.push(`/admin/institutes/${row.id}`);
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveInstitute({ variables: { id: approveTarget.id } });
      toast.success(t('approval.approveSuccess'));
      setApproveTarget(null);
      refetch();
    } catch {
      toast.error(t('actions.error'));
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || rejectReason.length < 10) return;
    try {
      await rejectInstitute({ variables: { id: rejectTarget.id, reason: rejectReason } });
      toast.success(t('approval.rejectSuccess'));
      setRejectTarget(null);
      setRejectReason('');
      refetch();
    } catch {
      toast.error(t('actions.error'));
    }
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4" data-testid={testIds.adminInstitutes.page}>
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid={testIds.adminInstitutes.title}
          >
            {t('title')}
          </h1>
          <p className="text-muted-foreground" data-testid={testIds.adminInstitutes.description}>
            {t('description')}
          </p>
        </div>
        <Can I="create" a="Institute">
          <Button onClick={() => router.push('/admin/institutes/new')}>
            <Plus className="size-4" />
            {t('createInstitute')}
          </Button>
        </Can>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid={testIds.adminInstitutes.tabAll}>
            {t('tabs.all')}
          </TabsTrigger>
          <TabsTrigger value="pendingApproval" data-testid={testIds.adminInstitutes.tabPending}>
            {t('tabs.pendingApproval')}
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ms-1.5 px-1.5 py-0 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} forceMount className="mt-4 space-y-4">
          {activeTab === 'all' && <InstituteFilters />}

          <DataTable
            data-testid={testIds.adminInstitutes.table}
            columns={activeTab === 'pendingApproval' ? approvalColumns : columns}
            data={institutes}
            isLoading={loading && institutes.length === 0}
            onRowClick={handleRowClick}
            emptyState={
              hasFilters || activeTab === 'pendingApproval' ? (
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchX />
                    </EmptyMedia>
                    <EmptyTitle>
                      {activeTab === 'pendingApproval' ? t('empty.noPending') : t('empty.title')}
                    </EmptyTitle>
                    <EmptyDescription>
                      {activeTab === 'pendingApproval'
                        ? t('empty.noPendingDescription')
                        : t('empty.description')}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Building2 />
                    </EmptyMedia>
                    <EmptyTitle>{t('empty.noData')}</EmptyTitle>
                    <EmptyDescription>{t('empty.noDataDescription')}</EmptyDescription>
                  </EmptyHeader>
                  <Can I="create" a="Institute">
                    <Button onClick={() => router.push('/admin/institutes/new')}>
                      <Plus className="me-1 size-4" />
                      {t('createInstitute')}
                    </Button>
                  </Can>
                </Empty>
              )
            }
          />

          <DataTablePagination
            hasNextPage={hasNextPage}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            totalCount={totalCount}
            currentCount={institutes.length}
            labels={{
              loadMore: t('pagination.loadMore'),
              showing: t('pagination.showing'),
              of: t('pagination.of'),
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Approve confirmation dialog */}
      <AlertDialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('approval.approveTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('approval.approveDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleApprove}>
              {t('approval.approveConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog with reason */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('approval.rejectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('approval.rejectDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel>{t('approval.rejectReason')}</FieldLabel>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('approval.rejectReasonPlaceholder')}
              rows={3}
            />
            {rejectReason.length > 0 && rejectReason.length < 10 && (
              <FieldError errors={[{ message: t('approval.rejectMinLength') }]} />
            )}
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectReason.length < 10}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('approval.rejectConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
