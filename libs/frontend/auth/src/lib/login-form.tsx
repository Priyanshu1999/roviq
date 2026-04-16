'use client';

import type { AuthScope } from '@roviq/common-types';
import { Button, useAppForm } from '@roviq/ui';
import { Fingerprint, Loader2 } from 'lucide-react';
import * as React from 'react';
import { z } from 'zod';
import { useAuth } from './auth-context';

type LoginFormValues = { username: string; password: string };

export interface LoginFormProps {
  /** Auth scope — determines which login mutation is called. Default: 'institute'. */
  scope?: AuthScope;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  labels?: {
    username?: string;
    password?: string;
    enterUsername?: string;
    enterPassword?: string;
    signIn?: string;
    signingIn?: string;
    signInWithPasskey?: string;
    or?: string;
    usernameRequired?: string;
    passwordRequired?: string;
    loginFailed?: string;
    passkeyNotAvailable?: string;
  };
}

export function LoginForm({ onSuccess, onError, labels }: LoginFormProps) {
  const { login, loginWithPasskey } = useAuth();
  const [isPasskeyLoading, setIsPasskeyLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const l = {
    username: labels?.username ?? 'Username',
    password: labels?.password ?? 'Password',
    enterUsername: labels?.enterUsername ?? 'Enter your username',
    enterPassword: labels?.enterPassword ?? 'Enter your password',
    signIn: labels?.signIn ?? 'Sign in',
    signingIn: labels?.signingIn ?? 'Signing in...',
    signInWithPasskey: labels?.signInWithPasskey ?? 'Sign in with passkey',
    or: labels?.or ?? 'or',
    usernameRequired: labels?.usernameRequired ?? 'Username is required',
    passwordRequired: labels?.passwordRequired ?? 'Password is required',
    loginFailed: labels?.loginFailed ?? 'Login failed. Please try again.',
    passkeyNotAvailable:
      labels?.passkeyNotAvailable ?? 'No passkey found. Try signing in with your password.',
  };

  const loginSchema = React.useMemo(
    () =>
      z.object({
        username: z.string().min(1, l.usernameRequired),
        password: z.string().min(1, l.passwordRequired),
      }),
    [l.usernameRequired, l.passwordRequired],
  );

  const form = useAppForm({
    defaultValues: { username: '', password: '' } satisfies LoginFormValues,
    validators: { onChange: loginSchema, onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      try {
        await login(value);
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : l.loginFailed;
        setError(message);
        onError?.(err instanceof Error ? err : new Error(message));
      }
    },
  });

  const handlePasskeyLogin = async () => {
    setIsPasskeyLoading(true);
    setError(null);
    try {
      await loginWithPasskey();
      onSuccess?.();
    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      const message =
        errName === 'NotAllowedError' || errName === 'AbortError'
          ? l.passkeyNotAvailable
          : err instanceof Error
            ? err.message
            : l.loginFailed;
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          data-testid="login-error"
        >
          {error}
        </div>
      )}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.AppField name="username">
          {(field) => (
            <field.TextField
              label={l.username}
              type="text"
              autoComplete="username webauthn"
              placeholder={l.enterUsername}
              disabled={isPasskeyLoading}
              testId="login-username-input"
              errorTestId="login-username-error"
            />
          )}
        </form.AppField>

        <form.AppField name="password">
          {(field) => (
            <field.TextField
              label={l.password}
              type="password"
              autoComplete="current-password"
              placeholder={l.enterPassword}
              disabled={isPasskeyLoading}
              testId="login-password-input"
              errorTestId="login-password-error"
            />
          )}
        </form.AppField>

        <form.AppForm>
          <form.SubmitButton
            testId="login-submit-btn"
            disabled={isPasskeyLoading}
            submittingLabel={l.signingIn}
            className="w-full"
          >
            {l.signIn}
          </form.SubmitButton>
        </form.AppForm>
      </form>

      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="text-muted-foreground px-3 text-xs uppercase tracking-wide">{l.or}</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={isPasskeyLoading}
        className="w-full gap-2.5"
        onClick={handlePasskeyLogin}
      >
        {isPasskeyLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Fingerprint className="size-4" />
        )}
        {isPasskeyLoading ? l.signingIn : l.signInWithPasskey}
      </Button>
    </div>
  );
}
