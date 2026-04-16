'use client';

import type { VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, type buttonVariants } from '../components/ui/button';
import { useFormContext } from './use-app-form';

export interface SubmitButtonProps extends VariantProps<typeof buttonVariants> {
  /** Label shown when the form is idle. */
  children: ReactNode;
  /** Label shown while `isSubmitting` is true. Defaults to `children`. */
  submittingLabel?: ReactNode;
  /** Force-disable the button regardless of form state. */
  disabled?: boolean;
  testId?: string;
  className?: string;
}

/**
 * Submit button bound to the form's `isSubmitting` and `canSubmit` state.
 * Subscribes via `form.Subscribe` so the surrounding form does not re-render
 * on every keystroke.
 *
 * Must be rendered inside `<form.AppForm>` so the form context is available.
 */
export function SubmitButton({
  children,
  submittingLabel,
  disabled,
  testId,
  className,
  variant,
  size,
}: SubmitButtonProps) {
  const form = useFormContext();
  return (
    <form.Subscribe
      selector={(state) => ({
        isSubmitting: state.isSubmitting,
        canSubmit: state.canSubmit,
      })}
    >
      {({ isSubmitting, canSubmit }) => (
        <Button
          type="submit"
          variant={variant}
          size={size}
          disabled={disabled || isSubmitting || !canSubmit}
          data-testid={testId}
          className={className}
        >
          {isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
          {isSubmitting && submittingLabel ? submittingLabel : children}
        </Button>
      )}
    </form.Subscribe>
  );
}
