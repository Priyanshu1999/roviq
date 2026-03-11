'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@roviq/ui';
import { Fingerprint, Loader2 } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from './auth-context';

export interface ReAuthFormLabels {
  password?: string;
  enterPassword?: string;
  signIn?: string;
  signingIn?: string;
  signInWithPasskey?: string;
  or?: string;
  passwordRequired?: string;
  loginFailed?: string;
  passkeyNotAvailable?: string;
}

interface ReAuthFormProps {
  username: string;
  onSuccess?: () => void;
  labels?: ReAuthFormLabels;
}

export function ReAuthForm({ username, onSuccess, labels }: ReAuthFormProps) {
  const { login, loginWithPasskey } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const l = {
    password: labels?.password ?? 'Password',
    enterPassword: labels?.enterPassword ?? 'Enter your password',
    signIn: labels?.signIn ?? 'Sign in',
    signingIn: labels?.signingIn ?? 'Signing in...',
    signInWithPasskey: labels?.signInWithPasskey ?? 'Sign in with passkey',
    or: labels?.or ?? 'or',
    passwordRequired: labels?.passwordRequired ?? 'Password is required',
    loginFailed: labels?.loginFailed ?? 'Login failed. Please try again.',
    passkeyNotAvailable:
      labels?.passkeyNotAvailable ?? 'No passkey found. Try signing in with your password.',
  };

  const schema = z.object({
    password: z.string().min(1, l.passwordRequired),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ password: string }>({
    resolver: zodResolver(schema),
    defaultValues: { password: '' },
  });

  const onSubmit = async (values: { password: string }) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await login({ username, password: values.password });
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : l.loginFailed;
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

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
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const isBusy = isSubmitting || isPasskeyLoading;
  const initials = username.charAt(0).toUpperCase();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-3 py-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {initials}
        </div>
        <span className="text-sm font-medium">{username}</span>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reauth-password">{l.password}</Label>
          <Input
            id="reauth-password"
            type="password"
            autoComplete="current-password"
            placeholder={l.enterPassword}
            autoFocus
            disabled={isBusy}
            {...register('password')}
          />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>

        <Button type="submit" disabled={isBusy} className="w-full">
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {l.signingIn}
            </>
          ) : (
            l.signIn
          )}
        </Button>
      </form>

      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="text-muted-foreground px-3 text-xs uppercase tracking-wide">{l.or}</span>
        <div className="flex-1 border-t border-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={isBusy}
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
