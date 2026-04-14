'use client';

import type { AcademicYearStatus } from '@roviq/graphql/generated';
import { useFormatDate } from '@roviq/i18n';
import {
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@roviq/ui';
import {
  Archive,
  CheckCircle2,
  Clock,
  GraduationCap,
  Layers,
  Pencil,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { CreateYearDialog } from './create-year-dialog';
import { EditYearSheet } from './edit-year-sheet';
import {
  type AcademicYear,
  useAcademicYears,
  useActivateAcademicYear,
  useArchiveAcademicYear,
  useDeleteAcademicYear,
} from './use-academic-years';
import { AcademicYearSelector } from './year-selector';

const STATUS_CONFIG: Record<
  AcademicYearStatus,
  { color: string; bg: string; border: string; icon: typeof Clock }
> = {
  PLANNING: {
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    icon: Clock,
  },
  ACTIVE: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    icon: Zap,
  },
  COMPLETING: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: Sparkles,
  },
  ARCHIVED: {
    color: 'text-zinc-500',
    bg: 'bg-zinc-50',
    border: 'border-zinc-200',
    icon: Archive,
  },
};

export default function AcademicYearsPage() {
  const t = useTranslations('academicYears');
  const { years, loading } = useAcademicYears();
  const [editingYear, setEditingYear] = useState<AcademicYear | null>(null);

  return (
    <Can I="read" a="AcademicYear" passThrough>
      {(allowed: boolean) =>
        allowed ? (
          <div className="space-y-6">
            <EditYearSheet
              year={editingYear}
              open={editingYear !== null}
              onOpenChange={(nextOpen) => {
                if (!nextOpen) setEditingYear(null);
              }}
            />
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1
                  className="text-2xl font-semibold tracking-tight"
                  data-testid="academic-years-title"
                >
                  {t('title')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
              </div>
              <div className="flex items-center gap-3">
                <AcademicYearSelector />
                <Can I="create" a="AcademicYear">
                  <CreateYearDialog />
                </Can>
              </div>
            </div>

            {/* Year Cards */}
            {loading ? (
              <YearCardsSkeleton />
            ) : years.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <GraduationCap />
                  </EmptyMedia>
                  <EmptyTitle>{t('noYears')}</EmptyTitle>
                  <EmptyDescription>{t('noYearsDescription')}</EmptyDescription>
                </EmptyHeader>
                <Can I="create" a="AcademicYear">
                  <CreateYearDialog />
                </Can>
              </Empty>
            ) : (
              <div
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                data-testid="academic-years-grid"
              >
                {years.map((year) => (
                  <YearCard key={year.id} year={year} onEdit={setEditingYear} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-muted-foreground">{t('accessDenied')}</p>
          </div>
        )
      }
    </Can>
  );
}

function YearCard({ year, onEdit }: { year: AcademicYear; onEdit: (year: AcademicYear) => void }) {
  const t = useTranslations('academicYears');
  const { format } = useFormatDate();
  const config = STATUS_CONFIG[year.status] ?? STATUS_CONFIG.PLANNING;
  const StatusIcon = config.icon;
  const isArchived = year.status === 'ARCHIVED';
  const termCount = Array.isArray(year.termStructure) ? year.termStructure.length : 0;

  return (
    <Card
      className={`
        relative overflow-hidden transition-all duration-200
        ${isArchived ? 'opacity-70' : 'hover:shadow-md'}
        ${year.isActive ? `ring-2 ring-emerald-400/50 ${config.border}` : ''}
      `}
    >
      {/* Active ribbon */}
      {year.isActive && (
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500" />
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold tracking-tight" data-testid="academic-year-label">
              {year.label}
            </h3>
            <p className="text-xs text-muted-foreground">
              {format(new Date(year.startDate), 'dd MMM yyyy')} —{' '}
              {format(new Date(year.endDate), 'dd MMM yyyy')}
            </p>
          </div>
          <Badge
            variant="secondary"
            className={`${config.bg} ${config.color} border-0 gap-1 text-[11px] font-medium`}
          >
            <StatusIcon className="size-3" />
            {t(`status.${year.status}`)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="size-3" />
            {t('terms', { count: termCount })}
          </span>
          {year.isActive && (
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="size-3" />
              {t('activeYear')}
            </span>
          )}
        </div>

        {/* Action buttons */}
        {!isArchived && (
          <div className="flex gap-2 pt-1">
            <Can I="update" a="AcademicYear">
              <Button
                data-testid="academic-years-edit-btn"
                variant="outline"
                size="sm"
                className="gap-1.5"
                title={t('edit')}
                onClick={() => onEdit(year)}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                {t('edit')}
              </Button>
            </Can>
            {year.status === 'PLANNING' && (
              <Can I="activate" a="AcademicYear">
                <ActivateButton year={year} />
              </Can>
            )}
            {year.status === 'COMPLETING' && (
              <Can I="archive" a="AcademicYear">
                <ArchiveButton year={year} />
              </Can>
            )}
            {year.status === 'PLANNING' && (
              <Can I="delete" a="AcademicYear">
                <DeleteButton year={year} />
              </Can>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivateButton({ year }: { year: AcademicYear }) {
  const t = useTranslations('academicYears');
  const { activateYear, loading } = useActivateAcademicYear();
  const [open, setOpen] = useState(false);

  const handleActivate = async () => {
    try {
      await activateYear(year.id);
      toast.success(t('activated', { year: year.label }));
      setOpen(false);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('already active')) {
        toast.error(t('errors.YEAR_ALREADY_ACTIVE'));
      } else {
        toast.error(message);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="default" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Zap className="size-3.5" />
        {t('activate')}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('activateTitle')}</DialogTitle>
          <DialogDescription>{t('activateConfirm', { year: year.label })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleActivate} disabled={loading}>
            {loading ? t('activating') : t('activate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveButton({ year }: { year: AcademicYear }) {
  const t = useTranslations('academicYears');
  const { archiveYear, loading } = useArchiveAcademicYear();
  const [open, setOpen] = useState(false);

  const handleArchive = async () => {
    try {
      await archiveYear(year.id);
      toast.success(t('archived', { year: year.label }));
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Archive className="size-3.5" />
        {t('archive')}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('archiveTitle')}</DialogTitle>
          <DialogDescription>{t('archiveConfirm', { year: year.label })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleArchive} disabled={loading}>
            {loading ? t('archiving') : t('archive')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ year }: { year: AcademicYear }) {
  const t = useTranslations('academicYears');
  const { deleteYear, loading } = useDeleteAcademicYear();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteYear(year.id);
      toast.success(t('deleted', { year: year.label }));
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        {t('delete')}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('delete')}</DialogTitle>
          <DialogDescription>{t('deleteConfirm', { year: year.label })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? '...' : t('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function YearCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-5 w-24 bg-muted rounded" />
                <div className="h-3 w-40 bg-muted rounded" />
              </div>
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-3 w-20 bg-muted rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
