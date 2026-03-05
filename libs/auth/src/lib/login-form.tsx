'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Input, Label } from '@roviq/ui';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from './auth-context';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  tenantId: z.string().min(1, 'Organization is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  tenantId?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function LoginForm({ tenantId, onSuccess, onError }: LoginFormProps) {
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
      tenantId: tenantId ?? '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await login(values);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
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

      {!tenantId && (
        <div className="space-y-2">
          <Label htmlFor="tenantId">Organization ID</Label>
          <Input
            id="tenantId"
            type="text"
            placeholder="Enter organization ID"
            {...register('tenantId')}
          />
          {errors.tenantId && <p className="text-destructive text-sm">{errors.tenantId.message}</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          type="text"
          autoComplete="username"
          placeholder="Enter your username"
          {...register('username')}
        />
        {errors.username && <p className="text-destructive text-sm">{errors.username.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          {...register('password')}
        />
        {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
      </div>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
