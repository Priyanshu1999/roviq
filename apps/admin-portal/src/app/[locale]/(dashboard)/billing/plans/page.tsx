'use client';

import { useFormatDate, useFormatNumber, useI18nField } from '@roviq/i18n';
import { Button, Can, DataTable } from '@roviq/ui';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { createPlanColumns } from './plan-columns';
import { PlanFormDialog } from './plan-form-dialog';
import { type SubscriptionPlanNode, useSubscriptionPlans } from './use-plans';

export default function PlansPage() {
  const t = useTranslations('billing');
  const { format } = useFormatDate();
  const { currency } = useFormatNumber();
  const ti = useI18nField();
  const { plans, loading } = useSubscriptionPlans();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<SubscriptionPlanNode | null>(null);

  const formatDate = React.useCallback((date: Date) => format(date, 'dd MMM yyyy'), [format]);

  const formatCurrency = React.useCallback((amount: number) => currency(amount), [currency]);

  const columns = React.useMemo(
    () => createPlanColumns(t, formatDate, formatCurrency, ti),
    [t, formatDate, formatCurrency, ti],
  );

  const handleRowClick = (plan: SubscriptionPlanNode) => {
    setEditingPlan(plan);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('plans.title')}</h1>
          <p className="text-muted-foreground">{t('plans.description')}</p>
        </div>
        <Can I="create" a="SubscriptionPlan">
          <Button onClick={handleCreate}>
            <Plus className="mr-1 size-4" />
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
                onRowClick={handleRowClick}
              />

              <PlanFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                plan={editingPlan}
                t={t}
              />
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
