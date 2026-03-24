'use client';

import { extractGraphQLError } from '@roviq/graphql';
import {
  Badge,
  Button,
  Can,
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
  Field,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
} from '@roviq/ui';
import { CreditCard, Plus, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import {
  useCreateGatewayConfig,
  useDeleteGatewayConfig,
  useGatewayConfigs,
  useUpdateGatewayConfig,
} from './use-gateway-configs';

const PROVIDERS = ['RAZORPAY', 'CASHFREE'] as const;

interface GatewayConfig {
  id: string;
  provider: string;
  status: string;
  displayName: string | null;
  isDefault: boolean;
  testMode: boolean;
  webhookUrl: string;
}

export default function GatewayConfigsPage() {
  const t = useTranslations('billing');
  const { configs, loading } = useGatewayConfigs();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingConfig, setEditingConfig] = React.useState<GatewayConfig | null>(null);

  const handleCreate = () => {
    setEditingConfig(null);
    setDialogOpen(true);
  };

  const handleEdit = (config: GatewayConfig) => {
    setEditingConfig(config);
    setDialogOpen(true);
  };

  if (loading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('gateway.title')}</h1>
          <p className="text-muted-foreground">{t('gateway.description')}</p>
        </div>
        <Can I="create" a="PaymentGatewayConfig">
          <Button onClick={handleCreate}>
            <Plus className="me-1 size-4" />
            {t('gateway.addGateway')}
          </Button>
        </Can>
      </div>

      {(configs as GatewayConfig[]).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="mb-4 size-12 text-muted-foreground" />
            <p className="text-muted-foreground">{t('gateway.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(configs as GatewayConfig[]).map((config) => (
            <Card
              key={config.id}
              className="cursor-pointer hover:border-primary/50"
              onClick={() => handleEdit(config)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="size-5" />
                    {config.provider}
                  </CardTitle>
                  <div className="flex gap-1">
                    {config.isDefault && <Badge>{t('gateway.default')}</Badge>}
                    {config.testMode && <Badge variant="outline">{t('gateway.test')}</Badge>}
                    <Badge variant={config.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {config.status}
                    </Badge>
                  </div>
                </div>
                {config.displayName && <CardDescription>{config.displayName}</CardDescription>}
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">{t('gateway.webhookUrl')}:</span>{' '}
                  <code className="rounded bg-muted px-1 py-0.5">{config.webhookUrl}</code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GatewayConfigDialog open={dialogOpen} onOpenChange={setDialogOpen} config={editingConfig} />
    </div>
  );
}

function GatewayConfigDialog({
  open,
  onOpenChange,
  config,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: GatewayConfig | null;
}) {
  const t = useTranslations('billing');
  const isEditing = !!config;
  const [createConfig] = useCreateGatewayConfig();
  const [updateConfig] = useUpdateGatewayConfig();
  const [deleteConfig] = useDeleteGatewayConfig();

  const [provider, setProvider] = React.useState(config?.provider ?? 'RAZORPAY');
  const [displayName, setDisplayName] = React.useState(config?.displayName ?? '');
  const [keyId, setKeyId] = React.useState('');
  const [keySecret, setKeySecret] = React.useState('');
  const [webhookSecret, setWebhookSecret] = React.useState('');
  const [testMode, setTestMode] = React.useState(config?.testMode ?? false);
  const [isDefault, setIsDefault] = React.useState(config?.isDefault ?? true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setProvider(config?.provider ?? 'RAZORPAY');
      setDisplayName(config?.displayName ?? '');
      setKeyId('');
      setKeySecret('');
      setWebhookSecret('');
      setTestMode(config?.testMode ?? false);
      setIsDefault(config?.isDefault ?? true);
    }
  }, [open, config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const credentials: Record<string, string> = {};
      if (provider === 'RAZORPAY') {
        if (keyId) credentials['RAZORPAY_KEY_ID'] = keyId;
        if (keySecret) credentials['RAZORPAY_KEY_SECRET'] = keySecret;
        if (webhookSecret) credentials['RAZORPAY_WEBHOOK_SECRET'] = webhookSecret;
      } else {
        if (keyId) credentials['CASHFREE_CLIENT_ID'] = keyId;
        if (keySecret) credentials['CASHFREE_CLIENT_SECRET'] = keySecret;
      }

      if (isEditing && config) {
        await updateConfig({
          variables: {
            id: config.id,
            input: {
              displayName: displayName || undefined,
              ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
              ...(webhookSecret ? { webhookSecret } : {}),
              testMode,
              isDefault,
            },
          },
        });
        toast.success(t('gateway.updateSuccess'));
      } else {
        await createConfig({
          variables: {
            input: {
              provider,
              displayName: displayName || undefined,
              credentials,
              webhookSecret: webhookSecret || undefined,
              testMode,
              isDefault,
            },
          },
        });
        toast.success(t('gateway.createSuccess'));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(extractGraphQLError(err, t('gateway.error')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!config) return;
    try {
      await deleteConfig({ variables: { id: config.id } });
      toast.success(t('gateway.deleteSuccess'));
      onOpenChange(false);
    } catch (err) {
      toast.error(extractGraphQLError(err, t('gateway.deleteError')));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('gateway.editGateway') : t('gateway.addGateway')}
          </DialogTitle>
          <DialogDescription>{t('gateway.formDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {!isEditing && (
              <Field>
                <FieldLabel>{t('gateway.provider')}</FieldLabel>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="displayName">{t('gateway.displayName')}</FieldLabel>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('gateway.displayNamePlaceholder')}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="keyId">
                {provider === 'RAZORPAY' ? t('gateway.keyId') : t('gateway.clientId')}
              </FieldLabel>
              <Input
                id="keyId"
                type="password"
                value={keyId}
                onChange={(e) => setKeyId(e.target.value)}
                placeholder={isEditing ? t('gateway.masked') : t('gateway.required')}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="keySecret">
                {provider === 'RAZORPAY' ? t('gateway.keySecret') : t('gateway.clientSecret')}
              </FieldLabel>
              <Input
                id="keySecret"
                type="password"
                value={keySecret}
                onChange={(e) => setKeySecret(e.target.value)}
                placeholder={isEditing ? t('gateway.masked') : t('gateway.required')}
              />
            </Field>

            {provider === 'RAZORPAY' && (
              <Field>
                <FieldLabel htmlFor="webhookSecret">{t('gateway.webhookSecret')}</FieldLabel>
                <Input
                  id="webhookSecret"
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={isEditing ? t('gateway.masked') : t('gateway.optional')}
                />
              </Field>
            )}

            <Field className="flex items-center justify-between">
              <FieldLabel htmlFor="testMode">{t('gateway.testMode')}</FieldLabel>
              <Switch id="testMode" checked={testMode} onCheckedChange={setTestMode} />
            </Field>

            <Field className="flex items-center justify-between">
              <FieldLabel htmlFor="isDefault">{t('gateway.defaultGateway')}</FieldLabel>
              <Switch id="isDefault" checked={isDefault} onCheckedChange={setIsDefault} />
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-6">
            {isEditing && (
              <Can I="delete" a="PaymentGatewayConfig">
                <Button type="button" variant="destructive" onClick={handleDelete}>
                  {t('gateway.delete')}
                </Button>
              </Can>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t('gateway.saving')
                : isEditing
                  ? t('gateway.saveChanges')
                  : t('gateway.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
