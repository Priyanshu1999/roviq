'use client';

import { NEW_PASSWORD_MIN_LENGTH } from '@roviq/common-types';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  fieldErrorMessages,
  Input,
  useAppForm,
} from '@roviq/ui';
import { Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import * as React from 'react';
import { z } from 'zod';
import { useAuth } from './auth-context';

export interface PasswordChangeFormLabels {
  title?: string;
  description?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  strengthLabel?: string;
  strengthWeak?: string;
  strengthFair?: string;
  strengthGood?: string;
  strengthStrong?: string;
  submit?: string;
  submitting?: string;
  showPassword?: string;
  hidePassword?: string;
  requirementsTitle?: string;
  reqMinLength?: string;
  reqMixedCase?: string;
  reqNumber?: string;
  reqDifferent?: string;
  mustDifferError?: string;
  minLengthError?: string;
  mismatchError?: string;
  requiredError?: string;
  successMessage?: string;
  genericError?: string;
}

export interface PasswordChangeFormProps {
  labels?: PasswordChangeFormLabels;
  /** Called on successful password change. Useful for showing a toast. */
  onSuccess?: () => void;
}

function resolveLabels(labels?: PasswordChangeFormLabels) {
  return {
    title: labels?.title ?? 'Change password',
    description:
      labels?.description ??
      'Changing your password will sign out all sessions, including this one. You will need to sign in again with your new password.',
    currentPassword: labels?.currentPassword ?? 'Current password',
    newPassword: labels?.newPassword ?? 'New password',
    confirmPassword: labels?.confirmPassword ?? 'Confirm new password',
    strengthLabel: labels?.strengthLabel ?? 'Password strength',
    strengthWeak: labels?.strengthWeak ?? 'Weak',
    strengthFair: labels?.strengthFair ?? 'Fair',
    strengthGood: labels?.strengthGood ?? 'Good',
    strengthStrong: labels?.strengthStrong ?? 'Strong',
    submit: labels?.submit ?? 'Change password',
    submitting: labels?.submitting ?? 'Changing…',
    showPassword: labels?.showPassword ?? 'Show password',
    hidePassword: labels?.hidePassword ?? 'Hide password',
    requirementsTitle: labels?.requirementsTitle ?? 'Password requirements',
    reqMinLength: labels?.reqMinLength ?? `At least ${NEW_PASSWORD_MIN_LENGTH} characters`,
    reqMixedCase: labels?.reqMixedCase ?? 'Mix of upper and lower case letters',
    reqNumber: labels?.reqNumber ?? 'At least one number',
    reqDifferent: labels?.reqDifferent ?? 'Different from the current password',
    mustDifferError:
      labels?.mustDifferError ?? 'New password must differ from the current password',
    minLengthError:
      labels?.minLengthError ?? `Password must be at least ${NEW_PASSWORD_MIN_LENGTH} characters`,
    mismatchError: labels?.mismatchError ?? 'Passwords do not match',
    requiredError: labels?.requiredError ?? 'Required',
    successMessage:
      labels?.successMessage ??
      'Password changed. You have been signed out — please sign in again with your new password.',
    genericError: labels?.genericError ?? 'Failed to change password',
  };
}

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

function scorePassword(value: string): PasswordStrength {
  if (value.length < 8) return 'weak';
  let score = 0;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  if (score <= 1) return 'fair';
  if (score === 2) return 'good';
  return 'strong';
}

function strengthMeta(strength: PasswordStrength, l: ReturnType<typeof resolveLabels>) {
  switch (strength) {
    case 'weak':
      return { label: l.strengthWeak, width: '25%', tone: 'bg-destructive' };
    case 'fair':
      return { label: l.strengthFair, width: '50%', tone: 'bg-amber-500' };
    case 'good':
      return { label: l.strengthGood, width: '75%', tone: 'bg-blue-500' };
    case 'strong':
      return { label: l.strengthStrong, width: '100%', tone: 'bg-emerald-500' };
  }
}

type FormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function PasswordChangeForm({ labels, onSuccess }: PasswordChangeFormProps) {
  const l = resolveLabels(labels);
  const { changePassword } = useAuth();

  const schema = React.useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, l.requiredError),
          newPassword: z.string().min(NEW_PASSWORD_MIN_LENGTH, l.minLengthError),
          confirmPassword: z.string().min(1, l.requiredError),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          path: ['confirmPassword'],
          message: l.mismatchError,
        })
        .refine((data) => data.currentPassword !== data.newPassword, {
          path: ['newPassword'],
          message: l.mustDifferError,
        }),
    [l.requiredError, l.minLengthError, l.mismatchError, l.mustDifferError],
  );

  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const form = useAppForm({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    } satisfies FormValues,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setServerError(null);
      setSuccessMessage(null);
      try {
        await changePassword(value.currentPassword, value.newPassword);
        setSuccessMessage(l.successMessage);
        formApi.reset();
        onSuccess?.();
      } catch (err) {
        setServerError(err instanceof Error ? err.message : l.genericError);
      }
    },
  });

  return (
    <Card data-testid="password-change-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2.5 text-lg tracking-tight">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <KeyRound className="size-4 text-primary" />
          </div>
          {l.title}
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed">{l.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <FieldGroup>
            {serverError ? (
              <div
                role="alert"
                data-testid="password-change-error"
                className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{serverError}</span>
              </div>
            ) : null}

            {successMessage ? (
              <div
                role="status"
                data-testid="password-change-success"
                className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400"
              >
                {successMessage}
              </div>
            ) : null}

            <form.Field name="currentPassword">
              {(field) => {
                const errs = fieldErrorMessages(field);
                return (
                  <Field>
                    <FieldLabel htmlFor="password-current">{l.currentPassword}</FieldLabel>
                    <div className="relative">
                      <Input
                        id="password-current"
                        type={showCurrent ? 'text' : 'password'}
                        autoComplete="current-password"
                        aria-invalid={errs.length > 0 || undefined}
                        data-testid="password-current-input"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                        onClick={() => setShowCurrent((v) => !v)}
                        aria-label={showCurrent ? l.hidePassword : l.showPassword}
                        aria-pressed={showCurrent}
                        tabIndex={-1}
                      >
                        {showCurrent ? (
                          <EyeOff className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Eye className="size-3.5" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                    {errs.length > 0 ? (
                      <FieldDescription className="text-destructive">
                        {errs[0]?.message}
                      </FieldDescription>
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="newPassword">
              {(field) => {
                const errs = fieldErrorMessages(field);
                const value = field.state.value;
                const strength = value ? scorePassword(value) : null;
                const meta = strength ? strengthMeta(strength, l) : null;
                return (
                  <Field>
                    <FieldLabel htmlFor="password-new">{l.newPassword}</FieldLabel>
                    <div className="relative">
                      <Input
                        id="password-new"
                        type={showNew ? 'text' : 'password'}
                        autoComplete="new-password"
                        aria-invalid={errs.length > 0 || undefined}
                        data-testid="password-new-input"
                        value={value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                        onClick={() => setShowNew((v) => !v)}
                        aria-label={showNew ? l.hidePassword : l.showPassword}
                        aria-pressed={showNew}
                        tabIndex={-1}
                      >
                        {showNew ? (
                          <EyeOff className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Eye className="size-3.5" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                    {meta ? (
                      <div className="mt-1.5 space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full transition-all duration-300 ${meta.tone}`}
                            style={{ width: meta.width }}
                            data-testid="password-strength-bar"
                          />
                        </div>
                        <p
                          className="text-xs text-muted-foreground"
                          data-testid="password-strength-label"
                        >
                          {l.strengthLabel}:{' '}
                          <span className="font-medium text-foreground">{meta.label}</span>
                        </p>
                      </div>
                    ) : null}
                    {errs.length > 0 ? (
                      <FieldDescription className="text-destructive">
                        {errs[0]?.message}
                      </FieldDescription>
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => {
                const errs = fieldErrorMessages(field);
                return (
                  <Field>
                    <FieldLabel htmlFor="password-confirm">{l.confirmPassword}</FieldLabel>
                    <div className="relative">
                      <Input
                        id="password-confirm"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        aria-invalid={errs.length > 0 || undefined}
                        data-testid="password-confirm-input"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                        onClick={() => setShowConfirm((v) => !v)}
                        aria-label={showConfirm ? l.hidePassword : l.showPassword}
                        aria-pressed={showConfirm}
                        tabIndex={-1}
                      >
                        {showConfirm ? (
                          <EyeOff className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Eye className="size-3.5" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                    {errs.length > 0 ? (
                      <FieldDescription className="text-destructive">
                        {errs[0]?.message}
                      </FieldDescription>
                    ) : null}
                  </Field>
                );
              }}
            </form.Field>

            <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="mb-1.5 font-medium text-foreground">{l.requirementsTitle}</p>
              <ul className="space-y-0.5 pl-3">
                <li className="list-disc">{l.reqMinLength}</li>
                <li className="list-disc">{l.reqMixedCase}</li>
                <li className="list-disc">{l.reqNumber}</li>
                <li className="list-disc">{l.reqDifferent}</li>
              </ul>
            </div>

            <form.AppForm>
              <form.SubmitButton
                testId="password-change-submit"
                submittingLabel={l.submitting}
                className="gap-1.5"
              >
                <KeyRound className="size-4" aria-hidden="true" />
                {l.submit}
              </form.SubmitButton>
            </form.AppForm>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
