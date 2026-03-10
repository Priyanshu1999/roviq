'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@roviq/ui';
import type { LoginFormProps } from './login-form';
import { LoginForm } from './login-form';

export interface SessionExpiredDialogLabels {
  title?: string;
  description?: string;
  formLabels?: LoginFormProps['labels'];
}

export interface SessionExpiredDialogProps {
  open: boolean;
  username?: string;
  onLoginSuccess: () => void;
  labels?: SessionExpiredDialogLabels;
}

export function SessionExpiredDialog({
  open,
  username: _username,
  onLoginSuccess,
  labels,
}: SessionExpiredDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{labels?.title ?? 'Session Expired'}</DialogTitle>
          <DialogDescription>
            {labels?.description ?? 'Your session has expired. Please log in again to continue.'}
          </DialogDescription>
        </DialogHeader>
        <LoginForm onSuccess={onLoginSuccess} labels={labels?.formLabels} />
      </DialogContent>
    </Dialog>
  );
}
