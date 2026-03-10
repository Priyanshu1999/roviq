'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@roviq/ui';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from './auth-context';

type LoginFormValues = { username: string; password: string };

export interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  labels?: {
    username?: string;
    password?: string;
    enterUsername?: string;
    enterPassword?: string;
    signIn?: string;
    signingIn?: string;
    usernameRequired?: string;
    passwordRequired?: string;
    loginFailed?: string;
  };
}

export function LoginForm({ onSuccess, onError, labels }: LoginFormProps) {
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const l = {
    username: labels?.username ?? 'Username',
    password: labels?.password ?? 'Password',
    enterUsername: labels?.enterUsername ?? 'Enter your username',
    enterPassword: labels?.enterPassword ?? 'Enter your password',
    signIn: labels?.signIn ?? 'Sign in',
    signingIn: labels?.signingIn ?? 'Signing in...',
    usernameRequired: labels?.usernameRequired ?? 'Username is required',
    passwordRequired: labels?.passwordRequired ?? 'Password is required',
    loginFailed: labels?.loginFailed ?? 'Login failed. Please try again.',
  };

  const loginSchema = z.object({
    username: z.string().min(1, l.usernameRequired),
    password: z.string().min(1, l.passwordRequired),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await login(values);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : l.loginFailed;
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="username">{l.username}</Label>
        <Input
          id="username"
          type="text"
          autoComplete="username"
          placeholder={l.enterUsername}
          {...register('username')}
        />
        {errors.username && <p className="text-destructive text-sm">{errors.username.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{l.password}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder={l.enterPassword}
          {...register('password')}
        />
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? l.signingIn : l.signIn}
      </Button>
    </form>
  );
}
