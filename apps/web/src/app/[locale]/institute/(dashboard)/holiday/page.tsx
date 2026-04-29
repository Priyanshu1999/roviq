'use client';

import { extractGraphQLError } from '@roviq/graphql';
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
  Card,
  CardContent,
  DataTable,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { type ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { HolidayCalendar } from './holiday-calendar';
import {
  HOLIDAY_TYPE_VALUES,
  type HolidayRecord,
  type HolidayType,
  useDeleteHoliday,
  useHolidays,
} from './use-holiday';

type HolidayViewMode = 'calendar' | 'table';

function isHolidayViewMode(value: string): value is HolidayViewMode {
  return value === 'calendar' || value === 'table';
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function isHolidayType(value: string | null): value is HolidayType {
  return value != null && (HOLIDAY_TYPE_VALUES as readonly string[]).includes(value);
}

export default function HolidaysPage() {
  const t = useTranslations('holiday');
  const params = useParams();
  const locale = params.locale as string;

  const [type, setType] = useQueryState('type', parseAsString);
  const [startDate, setStartDate] = useQueryState('startDate', parseAsString);
  const [endDate, setEndDate] = useQueryState('endDate', parseAsString);
  const [isPublic, setIsPublic] = useQueryState('isPublic', parseAsString);
  const [viewParam, setViewParam] = useQueryState('view', parseAsString.withDefault('calendar'));
  const view: HolidayViewMode = isHolidayViewMode(viewParam) ? viewParam : 'calendar';

  const filter = React.useMemo(
    () => ({
      type: isHolidayType(type) ? type : null,
      startDate,
      endDate,
      isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : null,
    }),
    [type, startDate, endDate, isPublic],
  );

  const { holidays, loading, refetch } = useHolidays(filter);

  const setView = React.useCallback(
    (next: HolidayViewMode) => {
      // Keep the default out of the URL so a bare /holiday stays clean.
      void setViewParam(next === 'calendar' ? null : next);
    },
    [setViewParam],
  );

  return (
    <Can I="read" a="Holiday" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <header className="flex items-center justify-between gap-4">
              <h1
                className="text-2xl font-semibold tracking-tight flex items-center gap-2"
                data-testid="holiday-title"
              >
                <CalendarDays className="size-6 text-primary" aria-hidden="true" />
                {t('title')}
              </h1>
              <Can I="update" a="Holiday">
                <Button asChild size="sm" className="gap-2" data-testid="holiday-add-btn">
                  <Link href={`/${locale}/institute/holiday/new`}>
                    <Plus className="size-4" aria-hidden="true" />
                    {t('addCta')}
                  </Link>
                </Button>
              </Can>
            </header>

            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-end">
                  <fieldset className="inline-flex rounded-md border bg-muted/30 p-0.5">
                    <legend className="sr-only">{t('title')}</legend>
                    <Button
                      type="button"
                      size="sm"
                      variant={view === 'calendar' ? 'default' : 'ghost'}
                      onClick={() => setView('calendar')}
                      aria-pressed={view === 'calendar'}
                      className="min-h-11 rounded-sm px-3 sm:min-h-9"
                      data-testid="holiday-view-toggle-calendar"
                    >
                      {t('view.calendar')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={view === 'table' ? 'default' : 'ghost'}
                      onClick={() => setView('table')}
                      aria-pressed={view === 'table'}
                      className="min-h-11 rounded-sm px-3 sm:min-h-9"
                      data-testid="holiday-view-toggle-table"
                    >
                      {t('view.table')}
                    </Button>
                  </fieldset>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('fields.type')}
                    </span>
                    <Select
                      value={type ?? '__all__'}
                      onValueChange={(v) => void setType(v === '__all__' ? null : v)}
                    >
                      <SelectTrigger data-testid="holiday-filter-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">—</SelectItem>
                        {HOLIDAY_TYPE_VALUES.map((v) => (
                          <SelectItem key={v} value={v} data-testid={`holiday-filter-type-${v}`}>
                            {t(`type.${v}`)}
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
                      onChange={(e) => void setStartDate(e.target.value || null)}
                      data-testid="holiday-filter-start-date"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('fields.endDate')}
                    </span>
                    <Input
                      type="date"
                      value={endDate ?? ''}
                      onChange={(e) => void setEndDate(e.target.value || null)}
                      data-testid="holiday-filter-end-date"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('fields.isPublic')}
                    </span>
                    <Select
                      value={isPublic ?? '__all__'}
                      onValueChange={(v) => void setIsPublic(v === '__all__' ? null : v)}
                    >
                      <SelectTrigger data-testid="holiday-filter-is-public">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">—</SelectItem>
                        <SelectItem value="true" data-testid="holiday-filter-is-public-true">
                          {t('public')}
                        </SelectItem>
                        <SelectItem value="false" data-testid="holiday-filter-is-public-false">
                          {t('draft')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {view === 'calendar' ? (
              <HolidayCalendar />
            ) : (
              <HolidaysTable holidays={holidays} loading={loading} onChanged={refetch} />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground" data-testid="holiday-access-denied">
              {t('accessDenied')}
            </p>
          </div>
        )
      }
    </Can>
  );
}

interface HolidaysTableProps {
  holidays: HolidayRecord[];
  loading: boolean;
  onChanged: () => void;
}

function HolidaysTable({ holidays, loading, onChanged }: HolidaysTableProps) {
  const t = useTranslations('holiday');
  const { format } = useFormatDate();
  const resolveI18n = useI18nField();
  const params = useParams();
  const locale = params.locale as string;
  const { mutate: deleteHoliday, loading: deleting } = useDeleteHoliday();

  const [pendingDelete, setPendingDelete] = React.useState<HolidayRecord | null>(null);

  async function handleConfirmDelete(): Promise<void> {
    if (!pendingDelete) return;
    try {
      await deleteHoliday(pendingDelete.id);
      toast.success(t('actions.delete'));
      onChanged();
    } catch (err) {
      toast.error(extractGraphQLError(err, t('actions.delete')));
    } finally {
      setPendingDelete(null);
    }
  }

  const columnHelper = createColumnHelper<HolidayRecord>();
  const columns: ColumnDef<HolidayRecord, unknown>[] = [
    columnHelper.accessor('name', {
      header: t('fields.name'),
      cell: ({ getValue, row }) => {
        const name = getValue();
        return (
          <span
            className="font-medium truncate"
            data-testid={`holiday-row-${row.original.id}-name`}
          >
            {resolveI18n(name) || row.original.id.slice(0, 8)}
          </span>
        );
      },
    }) as ColumnDef<HolidayRecord, unknown>,
    columnHelper.accessor('type', {
      header: t('fields.type'),
      cell: ({ getValue, row }) => {
        const v = getValue();
        return (
          <Badge variant="outline" data-testid={`holiday-row-${row.original.id}-type`}>
            {t(`type.${v}`)}
          </Badge>
        );
      },
    }) as ColumnDef<HolidayRecord, unknown>,
    columnHelper.display({
      id: 'dateRange',
      header: `${t('fields.startDate')} – ${t('fields.endDate')}`,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <span className="tabular-nums text-sm" data-testid={`holiday-row-${r.id}-dates`}>
            {format(parseIsoDateLocal(r.startDate), 'dd MMM yyyy')} –{' '}
            {format(parseIsoDateLocal(r.endDate), 'dd MMM yyyy')}
          </span>
        );
      },
    }) as ColumnDef<HolidayRecord, unknown>,
    columnHelper.accessor('isPublic', {
      header: t('fields.isPublic'),
      cell: ({ getValue, row }) => {
        const v = getValue();
        return (
          <Badge
            variant="outline"
            className={
              v
                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }
            data-testid={`holiday-row-${row.original.id}-public`}
          >
            {v ? t('public') : t('draft')}
          </Badge>
        );
      },
    }) as ColumnDef<HolidayRecord, unknown>,
    columnHelper.accessor('tags', {
      header: t('fields.tags'),
      cell: ({ getValue, row }) => {
        const tags = getValue();
        if (!tags || tags.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1" data-testid={`holiday-row-${row.original.id}-tags`}>
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        );
      },
    }) as ColumnDef<HolidayRecord, unknown>,
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-1">
            <Can I="update" a="Holiday">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="size-8 p-0"
                title={t('actions.save')}
                data-testid={`holiday-row-${r.id}-edit-btn`}
              >
                <Link href={`/${locale}/institute/holiday/${r.id}`}>
                  <Pencil className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </Can>
            <Can I="delete" a="Holiday">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 p-0 text-rose-600 hover:text-rose-700"
                onClick={() => setPendingDelete(r)}
                disabled={deleting}
                title={t('actions.delete')}
                data-testid={`holiday-row-${r.id}-delete-btn`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </Can>
          </div>
        );
      },
    }) as ColumnDef<HolidayRecord, unknown>,
  ];

  if (!loading && holidays.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarDays />
          </EmptyMedia>
          <EmptyTitle>{t('noHolidays')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={holidays}
        isLoading={loading}
        skeletonRows={5}
        data-testid="holiday-table"
      />
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent data-testid="holiday-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('actions.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('actions.deleteConfirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} data-testid="holiday-delete-cancel-btn">
              {t('actions.deleteConfirm.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              data-testid="holiday-delete-confirm-btn"
            >
              {deleting ? t('actions.deleting') : t('actions.deleteConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
