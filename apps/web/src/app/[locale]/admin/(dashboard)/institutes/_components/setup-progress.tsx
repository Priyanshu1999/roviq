'use client';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Progress,
} from '@roviq/ui';
import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { useAdminSetupProgress, useRetrySetup } from '../use-institutes';

type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface StepState {
  step: string;
  status: StepStatus;
  message?: string | null;
}

interface SetupProgressPanelProps {
  instituteId: string;
  initialSetupStatus: string;
}

function normaliseStatus(raw: string): StepStatus {
  const lower = raw.toLowerCase();
  if (lower === 'completed') return 'completed';
  if (lower === 'failed') return 'failed';
  if (lower === 'in_progress') return 'in_progress';
  return 'pending';
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') return <CheckCircle2 className="size-5 text-green-600" />;
  if (status === 'failed') return <XCircle className="size-5 text-red-600" />;
  if (status === 'in_progress')
    return <Loader2 className="size-5 animate-spin text-blue-600" aria-hidden="true" />;
  return <Circle className="size-5 text-muted-foreground" />;
}

/**
 * Live setup-progress panel. Subscribes to adminInstituteSetupProgress and renders
 * a vertical stepper with an aggregate progress bar. Shows a retry button when any
 * step has failed.
 */
export function SetupProgressPanel({ instituteId, initialSetupStatus }: SetupProgressPanelProps) {
  const t = useTranslations('adminInstitutes.setup');
  const [steps, setSteps] = React.useState<StepState[]>([]);
  const [current, setCurrent] = React.useState<{ completed: number; total: number } | null>(null);
  const [retrySetup, { loading: retrying }] = useRetrySetup();

  const isCompleted = initialSetupStatus === 'COMPLETED';
  const { data } = useAdminSetupProgress(instituteId, isCompleted);

  // Merge incoming progress events into step state
  React.useEffect(() => {
    const payload = data?.adminInstituteSetupProgress;
    if (!payload) return;
    const status = normaliseStatus(payload.status);
    setCurrent({ completed: payload.completedSteps, total: payload.totalSteps });
    setSteps((prev) => {
      const next = [...prev];
      const existingIdx = next.findIndex((s) => s.step === payload.step);
      const entry: StepState = {
        step: payload.step,
        status,
        message: payload.message ?? null,
      };
      if (existingIdx >= 0) next[existingIdx] = entry;
      else next.push(entry);
      return next;
    });
  }, [data]);

  const failedStep = steps.find((s) => s.status === 'failed');

  const handleRetry = async () => {
    try {
      await retrySetup({ variables: { id: instituteId } });
      setSteps([]);
      setCurrent(null);
      toast.success(t('retryTriggered'));
    } catch (err) {
      toast.error(t('retryFailed'), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (isCompleted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="size-5" />
            <span>{t('completed')}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progressPct =
    current && current.total > 0 ? Math.round((current.completed / current.total) * 100) : 0;

  return (
    <Card data-testid="setup-progress-panel">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {current && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {t('stepsComplete', { completed: current.completed, total: current.total })}
              </span>
              <span>{progressPct}%</span>
            </div>
            <Progress value={progressPct} aria-label={t('progressLabel')} />
          </div>
        )}

        {failedStep && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>{t('failedTitle', { step: failedStep.step })}</AlertTitle>
            <AlertDescription>
              {failedStep.message ?? t('failedGeneric')}
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  disabled={retrying}
                  onClick={handleRetry}
                  data-testid="setup-retry-button"
                >
                  {retrying ? (
                    <>
                      <Loader2 className="me-1 size-4 animate-spin" aria-hidden="true" />
                      {t('retrying')}
                    </>
                  ) : (
                    t('retry')
                  )}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {steps.length === 0 && !current ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>{t('waiting')}</span>
          </div>
        ) : (
          <ol className="space-y-3">
            {steps.map((step) => (
              <li key={step.step} className="flex items-start gap-3">
                <StepIcon status={step.status} />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {t(`steps.${step.step}`, { defaultValue: step.step })}
                  </p>
                  {step.message && <p className="text-xs text-muted-foreground">{step.message}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
