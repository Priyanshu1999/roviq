'use client';

import { useAuth } from '@roviq/auth';
import { extractGraphQLError } from '@roviq/graphql';
import { useFormatDate, useI18nField } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DataTable,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useDebounce,
} from '@roviq/ui';
import { testIds } from '@roviq/ui/testing/testid-registry';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import {
  CalendarOff,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Eye,
  Plus,
  User,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { useStudents } from '../people/students/use-students';
import {
  LEAVE_STATUS_VALUES,
  LEAVE_TYPE_VALUES,
  type LeaveRecord,
  type LeaveStatus,
  type LeaveType,
  useApproveLeave,
  useCancelLeave,
  useLeaves,
  useRejectLeave,
} from './use-leave';

const { instituteLeave } = testIds;
// Status chip colours — palette requested by the spec.
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

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

export default function LeavesPage() {
  const t = useTranslations('leave');
  const params = useParams();
  const locale = params.locale as string;

  const [tab, setTab] = useQueryState('tab', parseAsString.withDefault('all'));
  const [userId, setUserId] = useQueryState('userId', parseAsString);
  const [status, setStatus] = useQueryState('status', parseAsString);
  const [type, setType] = useQueryState('type', parseAsString);
  const [startDate, setStartDate] = useQueryState('startDate', parseAsString);
  const [endDate, setEndDate] = useQueryState('endDate', parseAsString);

  return (
    <Can I="read" a="Leave" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <header className="flex items-center justify-between gap-4">
              <div>
                <h1
                  className="text-2xl font-semibold tracking-tight flex items-center gap-2"
                  data-testid={instituteLeave.title}
                >
                  <CalendarOff className="size-6 text-primary" />
                  {t('title')}
                </h1>
              </div>
              <Can I="create" a="Leave">
                <Button asChild size="sm" className="gap-2" data-testid={instituteLeave.applyLink}>
                  <Link href={`/${locale}/institute/leave/apply`}>
                    <Plus className="size-4" />
                    {t('applyCta')}
                  </Link>
                </Button>
              </Can>
            </header>

            <Tabs value={tab} onValueChange={(v) => void setTab(v)}>
              <TabsList data-testid={instituteLeave.tabs}>
                <TabsTrigger value="all" data-testid={instituteLeave.tabAll}>
                  {t('all')}
                </TabsTrigger>
                <TabsTrigger value="pending" data-testid={instituteLeave.tabPending}>
                  {t('pending')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <AllLeavesTab
                  userId={userId}
                  status={isLeaveStatus(status) ? status : null}
                  type={isLeaveType(type) ? type : null}
                  startDate={startDate}
                  endDate={endDate}
                  onUserIdChange={setUserId}
                  onStatusChange={setStatus}
                  onTypeChange={setType}
                  onStartDateChange={setStartDate}
                  onEndDateChange={setEndDate}
                />
              </TabsContent>

              <TabsContent value="pending" className="mt-4">
                <PendingApprovalsTab />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground" data-testid={instituteLeave.accessDenied}>
              {t('accessDenied')}
            </p>
          </div>
        )
      }
    </Can>
  );
}

function isLeaveStatus(value: string | null): value is LeaveStatus {
  return value != null && (LEAVE_STATUS_VALUES as readonly string[]).includes(value);
}

function isLeaveType(value: string | null): value is LeaveType {
  return value != null && (LEAVE_TYPE_VALUES as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────────────────────────────
// All-leaves tab — filters + DataTable
// ─────────────────────────────────────────────────────────────────────

interface AllLeavesTabProps {
  userId: string | null;
  status: LeaveStatus | null;
  type: LeaveType | null;
  startDate: string | null;
  endDate: string | null;
  onUserIdChange: (next: string | null) => Promise<URLSearchParams>;
  onStatusChange: (next: string | null) => Promise<URLSearchParams>;
  onTypeChange: (next: string | null) => Promise<URLSearchParams>;
  onStartDateChange: (next: string | null) => Promise<URLSearchParams>;
  onEndDateChange: (next: string | null) => Promise<URLSearchParams>;
}

function AllLeavesTab({
  userId,
  status,
  type,
  startDate,
  endDate,
  onUserIdChange,
  onStatusChange,
  onTypeChange,
  onStartDateChange,
  onEndDateChange,
}: AllLeavesTabProps) {
  const t = useTranslations('leave');
  const { leaves, loading, refetch } = useLeaves({
    userId,
    status,
    type,
    startDate,
    endDate,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('fields.userId')}
              </span>
              <UserIdPicker value={userId} onChange={(v) => void onUserIdChange(v)} />
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('fields.type')}
              </span>
              <Select
                value={type ?? '__all__'}
                onValueChange={(v) => void onTypeChange(v === '__all__' ? null : v)}
              >
                <SelectTrigger data-testid={instituteLeave.filterType}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">—</SelectItem>
                  {LEAVE_TYPE_VALUES.map((v) => (
                    <SelectItem key={v} value={v} data-testid={`leave-filter-type-${v}`}>
                      {t(`type.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">Status</span>
              <Select
                value={status ?? '__all__'}
                onValueChange={(v) => void onStatusChange(v === '__all__' ? null : v)}
              >
                <SelectTrigger data-testid={instituteLeave.filterStatus}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">—</SelectItem>
                  {LEAVE_STATUS_VALUES.map((v) => (
                    <SelectItem key={v} value={v} data-testid={`leave-filter-status-${v}`}>
                      {t(`status.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('fields.startDate')}
              </span>
              <Input
                type="date"
                value={startDate ?? ''}
                onChange={(e) => void onStartDateChange(e.target.value || null)}
                data-testid={instituteLeave.filterStartDate}
              />
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                {t('fields.endDate')}
              </span>
              <Input
                type="date"
                value={endDate ?? ''}
                onChange={(e) => void onEndDateChange(e.target.value || null)}
                data-testid={instituteLeave.filterEndDate}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <LeavesTable leaves={leaves} loading={loading} onChanged={refetch} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Pending approvals tab — fixed status filter, same columns
// ─────────────────────────────────────────────────────────────────────

function PendingApprovalsTab() {
  const { leaves, loading, refetch } = useLeaves({ status: 'PENDING' });
  return <LeavesTable leaves={leaves} loading={loading} onChanged={refetch} />;
}

// ─────────────────────────────────────────────────────────────────────
// Shared DataTable
// ─────────────────────────────────────────────────────────────────────

interface LeavesTableProps {
  leaves: LeaveRecord[];
  loading: boolean;
  onChanged: () => void;
}

function LeavesTable({ leaves, loading, onChanged }: LeavesTableProps) {
  const t = useTranslations('leave');
  const { format } = useFormatDate();
  const resolveI18n = useI18nField();
  const params = useParams();
  const locale = params.locale as string;
  const { user } = useAuth();
  const { approve, loading: approving } = useApproveLeave();
  const { reject, loading: rejecting } = useRejectLeave();
  const { cancel, loading: cancelling } = useCancelLeave();

  // Membership-id → display-name map built from the student list. Leaves
  // store `userId` as a *membership* id, so we key on `membershipId` (not
  // the student profile id). 200 rows covers most institutes; outliers fall
  // back to a truncated chip below.
  const { students } = useStudents({ first: 200 });
  const nameByMembership = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      const first = resolveI18n(s.firstName) ?? '';
      const last = s.lastName ? (resolveI18n(s.lastName) ?? '') : '';
      const fullName = [first, last].filter(Boolean).join(' ');
      map.set(s.membershipId, `${fullName} · ${s.admissionNumber}`);
    }
    return map;
  }, [students, resolveI18n]);

  async function handleApprove(id: string): Promise<void> {
    if (!user?.membershipId) return;
    try {
      await approve(id, user.membershipId);
      toast.success(t('actions.approve'));
      onChanged();
    } catch (err) {
      toast.error(extractGraphQLError(err, t('actions.approve')));
    }
  }

  async function handleReject(id: string): Promise<void> {
    if (!user?.membershipId) return;
    try {
      await reject(id, user.membershipId);
      toast.success(t('actions.reject'));
      onChanged();
    } catch (err) {
      toast.error(extractGraphQLError(err, t('actions.reject')));
    }
  }

  async function handleCancel(id: string): Promise<void> {
    if (!user?.membershipId) return;
    try {
      await cancel(id, user.membershipId);
      toast.success(t('actions.cancel'));
      onChanged();
    } catch (err) {
      toast.error(extractGraphQLError(err, t('actions.cancel')));
    }
  }

  const columnHelper = createColumnHelper<LeaveRecord>();
  const columns: ColumnDef<LeaveRecord, unknown>[] = [
    columnHelper.accessor('userId', {
      header: t('fields.userId'),
      cell: ({ getValue, row }) => {
        const id = String(getValue());
        const label = nameByMembership.get(id) ?? id.slice(0, 8);
        return (
          <span
            className="font-medium truncate"
            data-testid={`leave-row-${row.original.id}-applicant`}
          >
            {label}
          </span>
        );
      },
    }) as ColumnDef<LeaveRecord, unknown>,
    columnHelper.accessor('type', {
      header: t('fields.type'),
      cell: ({ getValue, row }) => {
        const type = getValue();
        return (
          <Badge variant="outline" data-testid={`leave-row-${row.original.id}-type`}>
            {t(`type.${type}`)}
          </Badge>
        );
      },
    }) as ColumnDef<LeaveRecord, unknown>,
    columnHelper.display({
      id: 'dateRange',
      header: `${t('fields.startDate')} – ${t('fields.endDate')}`,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="tabular-nums text-sm" data-testid={`leave-row-${r.id}-dates`}>
            {format(parseIsoDateLocal(r.startDate), 'dd MMM yyyy')} –{' '}
            {format(parseIsoDateLocal(r.endDate), 'dd MMM yyyy')}
          </span>
        );
      },
    }) as ColumnDef<LeaveRecord, unknown>,
    columnHelper.accessor('status', {
      header: 'Status',
      cell: ({ getValue, row }) => {
        const status = getValue();
        return (
          <Badge
            variant="outline"
            className={STATUS_COLORS[status]}
            data-testid={`leave-row-${row.original.id}-status`}
          >
            {t(`status.${status}`)}
          </Badge>
        );
      },
    }) as ColumnDef<LeaveRecord, unknown>,
    columnHelper.accessor('reason', {
      header: t('fields.reason'),
      cell: ({ getValue, row }) => {
        const reason = String(getValue());
        return (
          <span
            className="text-sm text-muted-foreground"
            title={reason}
            data-testid={`leave-row-${row.original.id}-reason`}
          >
            {truncate(reason, 60)}
          </span>
        );
      },
    }) as ColumnDef<LeaveRecord, unknown>,
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const r = row.original;
        const isPending = r.status === 'PENDING';
        const canCancel = isPending || r.status === 'APPROVED';
        return (
          <div className="flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              data-testid={`leave-row-${r.id}-view-btn`}
              title="View"
            >
              <Link href={`/${locale}/institute/leave/${r.id}`}>
                <Eye className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            {isPending ? (
              <Can I="update" a="Leave">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 text-emerald-600 hover:text-emerald-700"
                  onClick={() => handleApprove(r.id)}
                  disabled={approving}
                  title={t('actions.approve')}
                  data-testid={`leave-row-${r.id}-approve-btn`}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 text-rose-600 hover:text-rose-700"
                  onClick={() => handleReject(r.id)}
                  disabled={rejecting}
                  title={t('actions.reject')}
                  data-testid={`leave-row-${r.id}-reject-btn`}
                >
                  <XCircle className="size-4" aria-hidden="true" />
                </Button>
              </Can>
            ) : null}
            {canCancel ? (
              <Can I="update" a="Leave">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-8 p-0 text-slate-600 hover:text-slate-700"
                  onClick={() => handleCancel(r.id)}
                  disabled={cancelling}
                  title={t('actions.cancel')}
                  data-testid={`leave-row-${r.id}-cancel-btn`}
                >
                  <CalendarOff className="size-4" aria-hidden="true" />
                </Button>
              </Can>
            ) : null}
          </div>
        );
      },
    }) as ColumnDef<LeaveRecord, unknown>,
  ];

  if (!loading && leaves.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarOff />
          </EmptyMedia>
          <EmptyTitle>{t('noLeaves')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <DataTable
      columns={columns}
      data={leaves}
      isLoading={loading}
      skeletonRows={5}
      data-testid={instituteLeave.table}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// UserId (membership) picker — mirrors the attendance-history picker.
// Backed by the student list because there's no shared membership
// lookup yet. A TODO remains to switch to a generic membership picker
// once that hook exists (staff members won't resolve today).
// ─────────────────────────────────────────────────────────────────────

function UserIdPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const t = useTranslations('leave');
  const resolveI18n = useI18nField();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 250);

  const { students } = useStudents({ first: 50, search: debouncedSearch || undefined });

  const selectedLabel = React.useMemo(() => {
    if (!value) return null;
    const stu = students.find((s) => s.id === value);
    if (!stu) return value.slice(0, 8);
    const first = resolveI18n(stu.firstName) ?? '';
    const last = stu.lastName ? (resolveI18n(stu.lastName) ?? '') : '';
    return `${[first, last].filter(Boolean).join(' ')} · ${stu.admissionNumber}`.trim();
  }, [value, students, resolveI18n]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={instituteLeave.userPicker}
        >
          <span className="truncate">{selectedLabel ?? t('fields.userId')}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t('fields.userId')}
            value={search}
            onValueChange={setSearch}
            data-testid={instituteLeave.userPickerInput}
          />
          <CommandList>
            <CommandEmpty>
              <span className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                <User className="size-4" aria-hidden="true" />
                {t('fields.userId')}
              </span>
            </CommandEmpty>
            <CommandGroup>
              {value ? (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  data-testid={instituteLeave.userPickerClear}
                >
                  <Check className="mr-2 size-4 opacity-0" />—
                </CommandItem>
              ) : null}
              {students.map((stu) => {
                const first = resolveI18n(stu.firstName) ?? '';
                const last = stu.lastName ? (resolveI18n(stu.lastName) ?? '') : '';
                const label = `${[first, last].filter(Boolean).join(' ')} · ${stu.admissionNumber}`;
                return (
                  <CommandItem
                    key={stu.id}
                    value={stu.id}
                    onSelect={() => {
                      onChange(stu.id);
                      setOpen(false);
                    }}
                    data-testid={`leave-user-picker-option-${stu.id}`}
                  >
                    <Check
                      className={`mr-2 size-4 ${value === stu.id ? 'opacity-100' : 'opacity-0'}`}
                    />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
