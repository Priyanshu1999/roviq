'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
} from '@roviq/ui';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { Fingerprint, KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAuth } from './auth-context';
import type { PasskeyInfo } from './types';

export interface PasskeyManagerLabels {
  title?: string;
  description?: string;
  addPasskey?: string;
  removePasskey?: string;
  noPasskeys?: string;
  passkeyName?: string;
  enterPasskeyName?: string;
  passkeyNameHint?: string;
  confirmPassword?: string;
  registeredAt?: string;
  lastUsedAt?: string;
  never?: string;
  backedUp?: string;
  cancel?: string;
  removePasskeyConfirm?: string;
  adding?: string;
  removing?: string;
  nameTooLong?: string;
  passkeyPasswordRequired?: string;
}

export interface PasskeyManagerMutations {
  myPasskeys: (accessToken: string) => Promise<PasskeyInfo[]>;
  generateRegistrationOptions: (
    password: string,
    accessToken: string,
  ) => Promise<Record<string, unknown>>;
  verifyRegistration: (
    credential: Record<string, unknown>,
    name: string | undefined,
    accessToken: string,
  ) => Promise<PasskeyInfo>;
  removePasskey: (passkeyId: string, accessToken: string) => Promise<boolean>;
}

export interface PasskeyManagerProps {
  mutations: PasskeyManagerMutations;
  labels?: PasskeyManagerLabels;
  formatDate: (date: string) => string;
}

function resolveLabels(labels?: PasskeyManagerLabels) {
  return {
    title: labels?.title ?? 'Passkeys',
    description: labels?.description ?? 'Manage your passkeys for passwordless sign-in',
    addPasskey: labels?.addPasskey ?? 'Add passkey',
    removePasskey: labels?.removePasskey ?? 'Remove',
    noPasskeys: labels?.noPasskeys ?? 'No passkeys registered yet',
    passkeyName: labels?.passkeyName ?? 'Passkey name',
    enterPasskeyName: labels?.enterPasskeyName ?? 'e.g. MacBook fingerprint',
    passkeyNameHint:
      labels?.passkeyNameHint ??
      'Helps you identify this passkey later, especially if you add multiple devices. e.g. \u201cOffice laptop\u201d, \u201ciPhone Face ID\u201d, \u201cYubiKey\u201d',
    confirmPassword: labels?.confirmPassword ?? 'Confirm your password',
    registeredAt: labels?.registeredAt ?? 'Registered',
    lastUsedAt: labels?.lastUsedAt ?? 'Last used',
    never: labels?.never ?? 'Never',
    backedUp: labels?.backedUp ?? 'Backed up',
    cancel: labels?.cancel ?? 'Cancel',
    removePasskeyConfirm:
      labels?.removePasskeyConfirm ?? 'Are you sure you want to remove this passkey?',
    adding: labels?.adding ?? 'Adding...',
    removing: labels?.removing ?? 'Removing...',
    nameTooLong: labels?.nameTooLong ?? 'Passkey name must be 100 characters or less',
    passkeyPasswordRequired:
      labels?.passkeyPasswordRequired ?? 'Password is required to add a passkey',
  };
}

export function PasskeyManager({ mutations, labels, formatDate }: PasskeyManagerProps) {
  const { getAccessToken } = useAuth();
  const [passkeys, setPasskeys] = React.useState<PasskeyInfo[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<PasskeyInfo | null>(null);
  const [isRemoving, setIsRemoving] = React.useState(false);

  const l = resolveLabels(labels);
  const fmt = formatDate;

  const loadPasskeys = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      const result = await mutations.myPasskeys(token);
      setPasskeys(result);
    } catch {
      setError('Failed to load passkeys');
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken, mutations]);

  React.useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  const handleRemove = async () => {
    if (!removeTarget) return;
    const token = getAccessToken();
    if (!token) return;
    setIsRemoving(true);
    try {
      await mutations.removePasskey(removeTarget.id, token);
      setPasskeys((prev) => prev.filter((p) => p.id !== removeTarget.id));
      setRemoveTarget(null);
    } catch {
      setError('Failed to remove passkey');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        {/* Accent strip — a thin gradient bar at the card top conveys security confidence */}
        <div className="h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2.5 text-lg tracking-tight">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <Fingerprint className="size-4 text-primary" />
              </div>
              {l.title}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">{l.description}</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="shrink-0 gap-1.5 shadow-sm"
          >
            <Plus className="size-3.5" />
            {l.addPasskey}
          </Button>
        </CardHeader>

        <CardContent className="pt-0">
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : passkeys.length === 0 ? (
            <button
              type="button"
              onClick={() => setShowAddDialog(true)}
              className="group flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/20 py-12 transition-colors hover:border-primary/40 hover:bg-primary/[0.02]"
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-muted/60 transition-colors group-hover:bg-primary/10">
                <Fingerprint className="size-6 text-muted-foreground transition-colors group-hover:text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{l.noPasskeys}</p>
            </button>
          ) : (
            <div className="space-y-2">
              {passkeys.map((passkey, idx) => (
                <div
                  key={passkey.id}
                  className="group flex items-center gap-4 rounded-lg border border-transparent p-3 transition-all duration-200 hover:border-border hover:bg-accent/40 hover:shadow-sm"
                  style={{
                    animation: 'passkey-fade-in 0.3s ease-out both',
                    animationDelay: `${idx * 60}ms`,
                  }}
                >
                  {/* Status indicator — green accent for backed-up, muted otherwise */}
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      passkey.backedUp
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <KeyRound className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-none tracking-tight">
                      {passkey.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs text-muted-foreground">
                        {l.registeredAt}: {fmt(passkey.registeredAt)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {l.lastUsedAt}: {passkey.lastUsedAt ? fmt(passkey.lastUsedAt) : l.never}
                      </span>
                      {passkey.backedUp && (
                        <Badge
                          variant="secondary"
                          className="gap-1 border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0 text-[11px] text-emerald-700 dark:text-emerald-400"
                        >
                          <ShieldCheck className="size-3" />
                          {l.backedUp}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                    onClick={() => setRemoveTarget(passkey)}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">{l.removePasskey}</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inline keyframes for staggered reveal — avoids external stylesheet dependency */}
      <style>{`
        @keyframes passkey-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <AddPasskeyDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        labels={l}
        mutations={mutations}
        getAccessToken={getAccessToken}
        onSuccess={(passkey) => {
          setPasskeys((prev) => [...prev, passkey]);
          setShowAddDialog(false);
        }}
      />

      <Dialog open={removeTarget !== null} onOpenChange={() => setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/10">
                <Trash2 className="size-4 text-destructive" />
              </div>
              {l.removePasskey}
            </DialogTitle>
            <DialogDescription className="pt-1">{l.removePasskeyConfirm}</DialogDescription>
          </DialogHeader>
          {removeTarget && (
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="text-sm font-medium">{removeTarget.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {l.registeredAt}: {fmt(removeTarget.registeredAt)}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={isRemoving}>
              {l.cancel}
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={isRemoving}>
              {isRemoving && <Loader2 className="size-4 animate-spin" />}
              {isRemoving ? l.removing : l.removePasskey}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type AddPasskeyFormValues = { name?: string; password: string };

function AddPasskeyDialog({
  open,
  onOpenChange,
  labels,
  mutations,
  getAccessToken,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: Record<string, string>;
  mutations: PasskeyManagerMutations;
  getAccessToken: () => string | null;
  onSuccess: (passkey: PasskeyInfo) => void;
}) {
  const [isAdding, setIsAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const addPasskeySchema = z.object({
    name: z.string().max(100, labels.nameTooLong).optional(),
    password: z.string().min(1, labels.passkeyPasswordRequired),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors },
  } = useForm<AddPasskeyFormValues>({
    resolver: zodResolver(addPasskeySchema),
    defaultValues: { name: '', password: '' },
  });

  const onSubmit = async (values: AddPasskeyFormValues) => {
    const token = getAccessToken();
    if (!token) return;

    setIsAdding(true);
    setError(null);
    try {
      const optionsJSON = await mutations.generateRegistrationOptions(values.password, token);
      const { startRegistration } = await import('@simplewebauthn/browser');
      const credential = await startRegistration({
        optionsJSON: optionsJSON as unknown as PublicKeyCredentialCreationOptionsJSON,
      });
      const passkey = await mutations.verifyRegistration(
        credential as unknown as Record<string, unknown>,
        values.name?.trim() || undefined,
        token,
      );
      onSuccess(passkey);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add passkey');
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      reset();
      setError(null);
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
                <KeyRound className="size-4 text-primary" />
              </div>
              {labels.addPasskey}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-5">
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="passkey-name" className="text-sm font-medium">
                {labels.passkeyName}
              </Label>
              <Input
                id="passkey-name"
                placeholder={labels.enterPasskeyName}
                disabled={isAdding}
                autoFocus
                {...register('name')}
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name.message}</p>
              )}
              <p className="text-xs text-muted-foreground">{labels.passkeyNameHint}</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="passkey-password" className="text-sm font-medium">
                {labels.confirmPassword}
              </Label>
              <Input
                id="passkey-password"
                type="password"
                autoComplete="current-password"
                disabled={isAdding}
                {...register('password')}
              />
              {formErrors.password && (
                <p className="text-sm text-destructive">{formErrors.password.message}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isAdding}
            >
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={isAdding} className="gap-1.5">
              {isAdding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Fingerprint className="size-4" />
              )}
              {isAdding ? labels.adding : labels.addPasskey}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
