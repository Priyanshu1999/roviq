'use client';

import { extractGraphQLError } from '@roviq/graphql';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import {
  type ApplicationStatusKey,
  getNextApplicationStatuses,
  isTerminalApplicationStatus,
} from '../admission-constants';
import { type ApplicationNode, useUpdateApplication } from '../use-admission';

export interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: ApplicationNode | null;
}

/**
 * Status transition dialog: lists only valid next states based on the
 * client-side mirror of the server state machine. The backend is the source
 * of truth — if it rejects, we surface the error.
 */
export function StatusChangeDialog({ open, onOpenChange, application }: StatusChangeDialogProps) {
  const t = useTranslations('admission');
  const [updateApplication, { loading }] = useUpdateApplication();
  const [target, setTarget] = React.useState<ApplicationStatusKey | ''>('');

  React.useEffect(() => {
    if (!open) setTarget('');
  }, [open]);

  if (!application) return null;

  const currentStatus = application.status;
  const isTerminal = isTerminalApplicationStatus(currentStatus);
  const transitions = getNextApplicationStatuses(currentStatus);

  const handleSubmit = async () => {
    if (!target) return;
    try {
      await updateApplication({
        variables: { id: application.id, input: { status: target } },
      });
      toast.success(t('applications.statusDialog.success'));
      onOpenChange(false);
    } catch (err) {
      const message = extractGraphQLError(err, t('applications.statusDialog.error'));
      toast.error(t('applications.statusDialog.error'), { description: message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="status-change-dialog">
        <DialogHeader>
          <DialogTitle>{t('applications.statusDialog.title')}</DialogTitle>
          <DialogDescription>{t('applications.statusDialog.description')}</DialogDescription>
        </DialogHeader>

        {isTerminal || transitions.length === 0 ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {t('applications.statusDialog.noTransitions')}
          </p>
        ) : (
          <Field>
            <FieldLabel htmlFor="status-target">
              {t('applications.statusDialog.statusLabel')}
            </FieldLabel>
            <Select value={target} onValueChange={(v) => setTarget(v as ApplicationStatusKey)}>
              <SelectTrigger id="status-target" data-testid="status-change-select">
                <SelectValue placeholder={t('applications.statusDialog.statusLabel')} />
              </SelectTrigger>
              <SelectContent>
                {transitions.map((s) => (
                  <SelectItem key={s} value={s} data-testid={`status-option-${s}`}>
                    {t(`applicationStatuses.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            data-testid="status-change-cancel-btn"
          >
            {t('applications.statusDialog.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!target || loading}
            data-testid="status-change-submit-btn"
          >
            {loading && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {t('applications.statusDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
