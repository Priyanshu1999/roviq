'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { useFormatDate, useFormatNumber, useI18nField } from '@roviq/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Can,
  DataTable,
} from '@roviq/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { createPlanColumns, type PlanAction } from './plan-columns';
import { PlanFormDialog } from './plan-form-dialog';
import { type SubscriptionPlanNode, useDeletePlan, useSubscriptionPlans } from './use-plans';

export default function PlansPage() {
  const t = useTranslations('billing');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const ti = useI18nField();
  const { plans, loading } = useSubscriptionPlans();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<SubscriptionPlanNode | null>(null);
  const [confirmAction, setConfirmAction] = React.useState<PlanAction | null>(null);
  const [isExecuting, setIsExecuting] = React.useState(false);

  const [deletePlan] = useDeletePlan();

  const formatDate = React.useCallback((date: Date) => format(date, 'dd MMM yyyy'), [format]);

  const formatCurrency = React.useCallback((amount: number) => currency(amount), [currency]);

  const handleAction = React.useCallback((action: PlanAction) => {
    if (action.type === 'edit') {
      setEditingPlan(action.plan);
      setDialogOpen(true);
    } else {
      setConfirmAction(action);
    }
  }, []);

  const columns = React.useMemo(
    () => createPlanColumns(t, formatDate, formatCurrency, ti, handleAction),
    [t, formatDate, formatCurrency, ti, handleAction],
  );

  const handleCreate = () => {
    setEditingPlan(null);
    setDialogOpen(true);
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    setIsExecuting(true);
    try {
      const id = confirmAction.plan.id;
      switch (confirmAction.type) {
        case 'delete':
          await deletePlan({ variables: { id } });
          toast.success(t('plans.actions.deleteSuccess'));
          break;
      }
    } catch (err) {
      const key = `plans.actions.${confirmAction.type}Error` as const;
      const fallback = t(key);
      toast.error(fallback, { description: extractGraphQLError(err, fallback) });
    } finally {
      setIsExecuting(false);
      setConfirmAction(null);
    }
  };

  const confirmText = confirmAction
    ? {
        title: t(`plans.actions.${confirmAction.type}ConfirmTitle`),
        description: t(`plans.actions.${confirmAction.type}ConfirmDescription`, {
          name: ti(confirmAction.plan.name as Record<string, string>),
        }),
        confirm: t(`plans.actions.${confirmAction.type}Confirm`),
      }
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('plans.title')}</h1>
          <p className="text-muted-foreground">{t('plans.description')}</p>
        </div>
        <Can I="create" a="SubscriptionPlan">
          <Button onClick={handleCreate}>
            <Plus className="me-1 size-4" />
            {t('plans.createPlan')}
          </Button>
        </Can>
      </div>

      <Can I="read" a="SubscriptionPlan" passThrough>
        {(allowed: boolean) =>
          allowed ? (
            <>
              <DataTable
                columns={columns}
                data={plans}
                isLoading={loading}
                emptyMessage={t('plans.empty')}
              />

              <PlanFormDialog open={dialogOpen} onOpenChange={setDialogOpen} plan={editingPlan} />

              <AlertDialog
                open={!!confirmAction}
                onOpenChange={(open) => {
                  if (!open) setConfirmAction(null);
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{confirmText?.title}</AlertDialogTitle>
                    <AlertDialogDescription>{confirmText?.description}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isExecuting}>
                      {t('plans.actions.cancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={executeAction}
                      disabled={isExecuting}
                      className={
                        confirmAction?.type === 'delete'
                          ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                          : undefined
                      }
                    >
                      {isExecuting ? t('plans.actions.executing') : confirmText?.confirm}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <div className="flex h-[50vh] items-center justify-center">
              <p className="text-muted-foreground">{t('plans.accessDenied')}</p>
            </div>
          )
        }
      </Can>
    </div>
  );
}
