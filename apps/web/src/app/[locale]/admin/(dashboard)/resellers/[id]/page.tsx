'use client';

import { RESELLER_TIER_VALUES } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { emptyStringToUndefined, useFormatDate } from '@roviq/i18n';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Can,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useAppForm,
  useBreadcrumbOverride,
} from '@roviq/ui';
import { Construction, Edit2, Layers, Loader2, ShieldOff, Trash2, Undo } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { STATUS_CLASS, STATUS_VARIANT, safeHexColor, TIER_CLASS } from '../reseller-badge-styles';
import { compactBranding, FQDN_RE, HEX_COLOR_RE, HTTP_URL_RE } from '../reseller-validators';
import type { ResellerNode, ResellerTier } from '../types';
import {
  useChangeResellerTier,
  useDeleteReseller,
  useReseller,
  useSuspendReseller,
  useUnsuspendReseller,
  useUpdateReseller,
} from '../use-resellers';

// ─── Dialog type ─────────────────────────────────────────────────────────────

type DialogType = 'edit' | 'changeTier' | 'suspend' | 'unsuspend' | 'delete' | null;

const TAB_VALUES = ['overview', 'institutes', 'team', 'activity', 'billing'] as const;

// ─── Coming-soon placeholder tab ─────────────────────────────────────────────

function ComingSoonTab({
  testId,
  title,
  description,
}: {
  testId: string;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent
        className="flex flex-col items-center gap-2 py-12 text-center"
        data-testid={testId}
      >
        <Construction className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

// ─── Edit Form Schema ─────────────────────────────────────────────────────────

const editResellerSchema = z.object({
  name: emptyStringToUndefined(z.string().min(2).max(255).optional()),
  customDomain: emptyStringToUndefined(z.string().max(255).regex(FQDN_RE).optional()),
  branding: z.object({
    logoUrl: emptyStringToUndefined(z.string().regex(HTTP_URL_RE).optional()),
    faviconUrl: emptyStringToUndefined(z.string().regex(HTTP_URL_RE).optional()),
    primaryColor: emptyStringToUndefined(z.string().regex(HEX_COLOR_RE).optional()),
    secondaryColor: emptyStringToUndefined(z.string().regex(HEX_COLOR_RE).optional()),
  }),
});

type EditResellerSchema = typeof editResellerSchema;
type EditResellerFormValues = z.input<EditResellerSchema>;

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

function EditResellerDialog({
  reseller,
  open,
  onClose,
  onSuccess,
}: {
  reseller: ResellerNode;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('adminResellers');
  const [updateReseller] = useUpdateReseller();

  const buildDefaults = React.useCallback(
    (): EditResellerFormValues => ({
      name: reseller.name,
      customDomain: reseller.customDomain ?? '',
      branding: {
        logoUrl: reseller.branding?.logoUrl ?? '',
        faviconUrl: reseller.branding?.faviconUrl ?? '',
        primaryColor: reseller.branding?.primaryColor ?? '',
        secondaryColor: reseller.branding?.secondaryColor ?? '',
      },
    }),
    [reseller],
  );

  const form = useAppForm({
    defaultValues: buildDefaults(),
    validators: { onChange: editResellerSchema, onSubmit: editResellerSchema },
    onSubmit: async ({ value }) => {
      const parsed = editResellerSchema.parse(value);
      try {
        const branding = compactBranding(parsed.branding);
        await updateReseller({
          variables: {
            id: reseller.id,
            input: {
              ...(parsed.name ? { name: parsed.name } : {}),
              ...(parsed.customDomain ? { customDomain: parsed.customDomain } : {}),
              // Omit `branding` entirely when all fields empty — sending `{}`
              // would overwrite existing server branding with an empty row.
              ...(branding ? { branding } : {}),
            },
          },
        });
        toast.success(t('actions.editSuccess'));
        onSuccess();
        onClose();
      } catch (err) {
        toast.error(extractGraphQLError(err, t('actions.error')));
      }
    },
  });

  // Re-seed defaults when the dialog reopens so each edit reads the latest
  // server state. Mirrors the previous RHF reset effect.
  React.useEffect(() => {
    if (open) form.reset(buildDefaults());
  }, [open, form, buildDefaults]);

  if (!open) return null;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="edit-reseller-dialog-title">
            {t('actions.editTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('actions.editDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4"
          data-testid="edit-reseller-form"
        >
          <FieldGroup>
            <form.AppField name="name">
              {(field) => (
                <field.TextField label={t('detail.fieldName')} testId="edit-reseller-name-input" />
              )}
            </form.AppField>

            <form.AppField name="customDomain">
              {(field) => (
                <field.TextField
                  label={t('detail.fieldCustomDomain')}
                  placeholder="portal.example.com"
                  testId="edit-reseller-domain-input"
                />
              )}
            </form.AppField>

            <div className="grid gap-3 sm:grid-cols-2">
              <form.AppField name="branding.logoUrl">
                {(field) => (
                  <field.TextField
                    label={t('detail.brandingLogoUrl')}
                    testId="edit-logo-url-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="branding.faviconUrl">
                {(field) => (
                  <field.TextField
                    label={t('detail.brandingFaviconUrl')}
                    testId="edit-favicon-url-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="branding.primaryColor">
                {(field) => (
                  <field.TextField
                    label={t('detail.brandingPrimaryColor')}
                    placeholder="#1677FF"
                    testId="edit-primary-color-input"
                  />
                )}
              </form.AppField>
              <form.AppField name="branding.secondaryColor">
                {(field) => (
                  <field.TextField
                    label={t('detail.brandingSecondaryColor')}
                    placeholder="#5BC0EB"
                    testId="edit-secondary-color-input"
                  />
                )}
              </form.AppField>
            </div>
          </FieldGroup>

          <AlertDialogFooter>
            <AlertDialogCancel type="button" data-testid="edit-cancel-btn">
              {t('actions.cancel')}
            </AlertDialogCancel>
            <form.AppForm>
              <form.SubmitButton testId="edit-save-btn" submittingLabel={t('actions.saving')}>
                {t('actions.confirm')}
              </form.SubmitButton>
            </form.AppForm>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Change Tier Dialog ────────────────────────────────────────────────────────

function ChangeTierDialog({
  reseller,
  open,
  onClose,
  onSuccess,
}: {
  reseller: ResellerNode;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations('adminResellers');
  const [changeTier] = useChangeResellerTier();
  const [newTier, setNewTier] = React.useState<ResellerTier>(reseller.tier);
  const [submitting, setSubmitting] = React.useState(false);

  // Reset to the current server tier whenever the dialog opens so a re-open
  // after an external tier change doesn't present a stale selection.
  React.useEffect(() => {
    if (open) setNewTier(reseller.tier);
  }, [open, reseller.tier]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await changeTier({ variables: { id: reseller.id, newTier } });
      toast.success(t('actions.tierSuccess'));
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(extractGraphQLError(err, t('actions.error')));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle data-testid="change-tier-dialog-title">
            {t('actions.changeTierTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>{t('actions.changeTierDescription')}</AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel>{t('actions.newTier')}</FieldLabel>
          <Select value={newTier} onValueChange={(v) => setNewTier(v as ResellerTier)}>
            <SelectTrigger data-testid="change-tier-select">
              <SelectValue placeholder={t('actions.newTierPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {RESELLER_TIER_VALUES.map((tier) => (
                <SelectItem key={tier} value={tier} data-testid={`tier-option-${tier}`}>
                  {t(`tiers.${tier}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>{t(`tierDescriptions.${newTier}`)}</FieldDescription>
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="change-tier-cancel-btn">
            {t('actions.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={submitting}
            data-testid="change-tier-confirm-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="me-2 size-4 animate-spin" />
                {t('actions.saving')}
              </>
            ) : (
              t('actions.confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Detail Page ──────────────────────────────────────────────────────────────

export default function ResellerDetailPage() {
  const t = useTranslations('adminResellers');
  const { format: fmt, formatDistance } = useFormatDate();
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  const [activeTab, setActiveTab] = useQueryState(
    'tab',
    parseAsStringLiteral(TAB_VALUES).withDefault('overview'),
  );
  const [dialog, setDialog] = React.useState<DialogType>(null);
  const [suspendReason, setSuspendReason] = React.useState('');
  const [actionSubmitting, setActionSubmitting] = React.useState(false);

  const { data, loading, refetch } = useReseller(id);
  const reseller = data?.adminGetReseller;

  const [suspendReseller] = useSuspendReseller();
  const [unsuspendReseller] = useUnsuspendReseller();
  const [deleteReseller] = useDeleteReseller();

  useBreadcrumbOverride(reseller ? { [id]: reseller.name } : {});

  const formatRelative = React.useCallback(
    (date: string) => formatDistance(new Date(date), new Date()),
    [formatDistance],
  );

  // DD/MM/YYYY per Indian convention (frontend-ux reference [GYATP]).
  // `fmt` wraps date-fns `format` which picks up the active locale via useDateLocale,
  // so month/day names localize automatically; numeric tokens stay as configured.
  const formatAbsolute = React.useCallback(
    (date: string) => fmt(new Date(date), 'dd/MM/yyyy'),
    [fmt],
  );

  const handleSuspend = async () => {
    if (!reseller) return;
    setActionSubmitting(true);
    try {
      await suspendReseller({
        variables: { resellerId: reseller.id, ...(suspendReason ? { reason: suspendReason } : {}) },
      });
      toast.success(t('actions.suspendSuccess'));
      setDialog(null);
      setSuspendReason('');
      refetch();
    } catch (err) {
      toast.error(extractGraphQLError(err, t('actions.error')));
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!reseller) return;
    setActionSubmitting(true);
    try {
      await unsuspendReseller({ variables: { resellerId: reseller.id } });
      toast.success(t('actions.unsuspendSuccess'));
      setDialog(null);
      refetch();
    } catch (err) {
      toast.error(extractGraphQLError(err, t('actions.error')));
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!reseller) return;
    setActionSubmitting(true);
    try {
      await deleteReseller({ variables: { resellerId: reseller.id } });
      toast.success(t('actions.deleteSuccess'));
      router.push('/admin/resellers');
    } catch (err) {
      toast.error(extractGraphQLError(err, t('actions.error')));
    } finally {
      setActionSubmitting(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading && !reseller) {
    return (
      <div className="space-y-4" data-testid="reseller-detail-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!reseller) {
    return (
      <div className="py-16 text-center" data-testid="reseller-not-found">
        <p className="text-muted-foreground">{t('detail.notFound')}</p>
      </div>
    );
  }

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6" data-testid="reseller-detail-page">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" data-testid="reseller-detail-title">
              {reseller.name}
            </h1>
            <Badge
              variant={STATUS_VARIANT[reseller.status]}
              className={STATUS_CLASS[reseller.status]}
              data-testid="reseller-status-badge"
            >
              {t(`statuses.${reseller.status}`)}
            </Badge>
            <Badge
              variant="secondary"
              className={TIER_CLASS[reseller.tier]}
              data-testid="reseller-tier-badge"
            >
              {t(`tiers.${reseller.tier}`)}
            </Badge>
            {reseller.isSystem && (
              <Badge variant="outline" data-testid="reseller-system-badge">
                {t('detail.systemBadge')}
              </Badge>
            )}
          </div>
          <p className="font-mono text-sm text-muted-foreground">{reseller.slug}</p>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-wrap gap-2" data-testid="reseller-actions">
          <Can I="update" a="Reseller">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog('edit')}
              title={t('actions.editDescription')}
              data-testid="action-edit-btn"
            >
              <Edit2 className="me-1 size-4" />
              {t('actions.edit')}
            </Button>
          </Can>

          {!reseller.isSystem && (
            <>
              <Can I="update" a="Reseller">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialog('changeTier')}
                  title={t('actions.changeTierDescription')}
                  data-testid="action-change-tier-btn"
                >
                  <Layers className="me-1 size-4" />
                  {t('actions.changeTier')}
                </Button>
              </Can>

              {reseller.status === 'ACTIVE' && (
                <Can I="suspend" a="Reseller">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDialog('suspend')}
                    title={t('actions.suspendDescription')}
                    data-testid="action-suspend-btn"
                  >
                    <ShieldOff className="me-1 size-4" />
                    {t('actions.suspend')}
                  </Button>
                </Can>
              )}

              {reseller.status === 'SUSPENDED' && (
                <>
                  <Can I="update" a="Reseller">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog('unsuspend')}
                      title={t('actions.unsuspendDescription')}
                      data-testid="action-unsuspend-btn"
                    >
                      <Undo className="me-1 size-4" />
                      {t('actions.unsuspend')}
                    </Button>
                  </Can>
                  <Can I="delete" a="Reseller">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDialog('delete')}
                      title={t('actions.deleteDescription')}
                      data-testid="action-delete-btn"
                    >
                      <Trash2 className="me-1 size-4" />
                      {t('actions.delete')}
                    </Button>
                  </Can>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {reseller.isSystem && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          data-testid="reseller-system-notice"
        >
          {t('detail.systemNote')}
        </div>
      )}

      {/* Tabs — shadcn Tabs passes the raw value string; parseAsStringLiteral
          guarantees on read that it's one of TAB_VALUES, so we only need to
          forward the string untouched and let the setter reject unknowns. */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          if ((TAB_VALUES as readonly string[]).includes(v)) {
            setActiveTab(v as (typeof TAB_VALUES)[number]);
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            {t('detail.tabs.overview')}
          </TabsTrigger>
          <TabsTrigger value="institutes" data-testid="tab-institutes">
            {t('detail.tabs.institutes')}
          </TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">
            {t('detail.tabs.team')}
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            {t('detail.tabs.activity')}
          </TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">
            {t('detail.tabs.billing')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-4 space-y-4" data-testid="tab-content-overview">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Identity card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('detail.identity')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.fieldName')}</span>
                  <span className="font-medium" data-testid="detail-name">
                    {reseller.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.fieldSlug')}</span>
                  <span className="font-mono" data-testid="detail-slug">
                    {reseller.slug}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.fieldTier')}</span>
                  <Badge
                    variant="secondary"
                    className={TIER_CLASS[reseller.tier]}
                    data-testid="detail-tier"
                  >
                    {t(`tiers.${reseller.tier}`)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.fieldStatus')}</span>
                  <Badge
                    variant={STATUS_VARIANT[reseller.status]}
                    className={STATUS_CLASS[reseller.status]}
                    data-testid="detail-status"
                  >
                    {t(`statuses.${reseller.status}`)}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.fieldCustomDomain')}</span>
                  <span data-testid="detail-domain">
                    {reseller.customDomain ?? (
                      <span className="text-muted-foreground">{t('detail.noDomain')}</span>
                    )}
                  </span>
                </div>
                {reseller.suspendedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('detail.fieldSuspendedAt')}</span>
                    <span data-testid="detail-suspended-at">
                      {formatAbsolute(reseller.suspendedAt)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats card */}
            <Card>
              <CardHeader>
                <CardTitle>{t('detail.stats')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.fieldInstituteCount')}</span>
                  <span className="font-semibold tabular-nums" data-testid="detail-institute-count">
                    {reseller.instituteCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.fieldTeamSize')}</span>
                  <span className="font-semibold tabular-nums" data-testid="detail-team-size">
                    {reseller.teamSize}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.fieldCreatedAt')}</span>
                  <span className="text-muted-foreground" data-testid="detail-created-at">
                    {formatRelative(reseller.createdAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('detail.fieldUpdatedAt')}</span>
                  <span className="text-muted-foreground" data-testid="detail-updated-at">
                    {formatRelative(reseller.updatedAt)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Branding card */}
            {reseller.branding && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>{t('detail.branding')}</CardTitle>
                </CardHeader>
                <CardContent
                  className="grid gap-3 text-sm sm:grid-cols-2"
                  data-testid="detail-branding"
                >
                  {reseller.branding.logoUrl && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('detail.brandingLogoUrl')}</span>
                      <a
                        href={reseller.branding.logoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary underline-offset-2 hover:underline"
                        data-testid="detail-logo-url"
                      >
                        {reseller.branding.logoUrl}
                      </a>
                    </div>
                  )}
                  {reseller.branding.faviconUrl && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('detail.brandingFaviconUrl')}
                      </span>
                      <a
                        href={reseller.branding.faviconUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary underline-offset-2 hover:underline"
                        data-testid="detail-favicon-url"
                      >
                        {reseller.branding.faviconUrl}
                      </a>
                    </div>
                  )}
                  {reseller.branding.primaryColor && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t('detail.brandingPrimaryColor')}
                      </span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const safe = safeHexColor(reseller.branding.primaryColor);
                          // Only render the swatch when the color matches the strict
                          // hex-6 pattern. Defense-in-depth against a poisoned DB row
                          // smuggling CSS through the inline style prop.
                          return safe ? (
                            <span
                              className="inline-block size-4 rounded border"
                              style={{ background: safe }}
                            />
                          ) : null;
                        })()}
                        <span className="font-mono" data-testid="detail-primary-color">
                          {reseller.branding.primaryColor}
                        </span>
                      </div>
                    </div>
                  )}
                  {reseller.branding.secondaryColor && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t('detail.brandingSecondaryColor')}
                      </span>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const safe = safeHexColor(reseller.branding.secondaryColor);
                          return safe ? (
                            <span
                              className="inline-block size-4 rounded border"
                              style={{ background: safe }}
                            />
                          ) : null;
                        })()}
                        <span className="font-mono" data-testid="detail-secondary-color">
                          {reseller.branding.secondaryColor}
                        </span>
                      </div>
                    </div>
                  )}
                  {!reseller.branding.logoUrl &&
                    !reseller.branding.faviconUrl &&
                    !reseller.branding.primaryColor &&
                    !reseller.branding.secondaryColor && (
                      <p className="text-muted-foreground">{t('detail.noBranding')}</p>
                    )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Institutes Tab */}
        <TabsContent value="institutes" className="mt-4" data-testid="tab-content-institutes">
          <ComingSoonTab
            testId="institutes-placeholder"
            title={t('detail.comingSoonTitle')}
            description={t('detail.institutesPlaceholder')}
          />
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="mt-4" data-testid="tab-content-team">
          <ComingSoonTab
            testId="team-placeholder"
            title={t('detail.comingSoonTitle')}
            description={t('detail.teamPlaceholder')}
          />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-4" data-testid="tab-content-activity">
          <ComingSoonTab
            testId="activity-placeholder"
            title={t('detail.comingSoonTitle')}
            description={t('detail.activityPlaceholder')}
          />
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="mt-4" data-testid="tab-content-billing">
          <ComingSoonTab
            testId="billing-placeholder"
            title={t('detail.comingSoonTitle')}
            description={t('detail.billingPlaceholder')}
          />
        </TabsContent>
      </Tabs>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Edit dialog */}
      <EditResellerDialog
        reseller={reseller}
        open={dialog === 'edit'}
        onClose={() => setDialog(null)}
        onSuccess={refetch}
      />

      {/* Change Tier dialog */}
      <ChangeTierDialog
        reseller={reseller}
        open={dialog === 'changeTier'}
        onClose={() => setDialog(null)}
        onSuccess={refetch}
      />

      {/* Suspend dialog */}
      <AlertDialog
        open={dialog === 'suspend'}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null);
            setSuspendReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="suspend-dialog-title">
              {t('actions.suspendTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('actions.suspendDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel>{t('actions.suspendReason')}</FieldLabel>
            <Textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder={t('actions.suspendReasonPlaceholder')}
              rows={3}
              data-testid="suspend-reason-input"
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="suspend-cancel-btn"
              onClick={() => {
                setDialog(null);
                setSuspendReason('');
              }}
            >
              {t('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSuspend}
              disabled={actionSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="suspend-confirm-btn"
            >
              {actionSubmitting ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              {t('actions.suspendConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unsuspend dialog */}
      <AlertDialog open={dialog === 'unsuspend'} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="unsuspend-dialog-title">
              {t('actions.unsuspendTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('actions.unsuspendDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="unsuspend-cancel-btn">
              {t('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnsuspend}
              disabled={actionSubmitting}
              data-testid="unsuspend-confirm-btn"
            >
              {actionSubmitting ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              {t('actions.unsuspendConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={dialog === 'delete'} onOpenChange={(o) => !o && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="delete-dialog-title">
              {t('actions.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('actions.deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground" data-testid="delete-grace-period-note">
            {t('actions.deleteGracePeriod')}
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-btn">
              {t('actions.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={actionSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="delete-confirm-btn"
            >
              {actionSubmitting ? <Loader2 className="me-2 size-4 animate-spin" /> : null}
              {t('actions.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
