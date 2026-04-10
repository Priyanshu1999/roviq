'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { useI18nField } from '@roviq/i18n';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useBreadcrumbOverride,
} from '@roviq/ui';
import { CheckCircle2, Loader2, Pause, Play, ShieldOff, Trash2, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import type { InstituteStatus } from '../types';
import {
  useActivateInstitute,
  useDeactivateInstitute,
  useDeleteInstitute,
  useInstitute,
  useRejectInstitute,
  useRestoreInstitute,
  useSuspendInstitute,
} from '../use-institutes';

const STATUS_COLOR: Record<InstituteStatus, string> = {
  PENDING_APPROVAL: 'border-amber-300 text-amber-700',
  PENDING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-600',
  SUSPENDED: 'bg-red-100 text-red-700',
  REJECTED: 'line-through opacity-60',
};

type ActionType = 'activate' | 'deactivate' | 'suspend' | 'reject' | 'delete' | 'restore';
type ActionDialog = { type: ActionType; needsReason?: boolean } | null;

// Infer the institute type from the hook return
type InstituteData = NonNullable<ReturnType<typeof useInstitute>['data']>['adminGetInstitute'];

// ── Action Buttons (extracted to reduce cognitive complexity) ──

function ActionButtons({
  institute,
  canActivate,
  ta,
  setActionDialog,
}: {
  institute: NonNullable<InstituteData>;
  canActivate: boolean;
  ta: ReturnType<typeof useTranslations<'adminInstitutes.actions'>>;
  setActionDialog: (d: ActionDialog) => void;
}) {
  return (
    <div className="flex gap-2">
      {institute.status === 'INACTIVE' && (
        <ActivateWithTooltip canActivate={canActivate} ta={ta} setActionDialog={setActionDialog} />
      )}
      {institute.status === 'ACTIVE' && (
        <ActiveStatusActions ta={ta} setActionDialog={setActionDialog} />
      )}
      {institute.status === 'SUSPENDED' && (
        <Button
          variant="outline"
          size="sm"
          title={ta('activateDescription')}
          onClick={() => setActionDialog({ type: 'activate' })}
        >
          <Play className="size-4" />
          {ta('activate')}
        </Button>
      )}
      {institute.status === 'PENDING_APPROVAL' && (
        <Button
          size="sm"
          title={ta('approveDescription')}
          onClick={() => setActionDialog({ type: 'activate' })}
        >
          <CheckCircle2 className="size-4" />
          {ta('approve')}
        </Button>
      )}
      {(institute.status === 'PENDING' || institute.status === 'PENDING_APPROVAL') && (
        <Button
          variant="destructive"
          size="sm"
          title={ta('rejectDescription')}
          onClick={() => setActionDialog({ type: 'reject', needsReason: true })}
        >
          <XCircle className="size-4" />
          {ta('reject')}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        title={ta('deleteDescription')}
        onClick={() => setActionDialog({ type: 'delete' })}
      >
        <Trash2 className="size-4" />
        {ta('delete')}
      </Button>
    </div>
  );
}

function ActivateWithTooltip({
  canActivate,
  ta,
  setActionDialog,
}: {
  canActivate: boolean;
  ta: ReturnType<typeof useTranslations<'adminInstitutes.actions'>>;
  setActionDialog: (d: ActionDialog) => void;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              size="sm"
              disabled={!canActivate}
              onClick={() => setActionDialog({ type: 'activate' })}
            >
              <Play className="size-4" />
              {ta('activate')}
            </Button>
          </span>
        </TooltipTrigger>
        {!canActivate && <TooltipContent>{ta('activateDisabled')}</TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );
}

function ActiveStatusActions({
  ta,
  setActionDialog,
}: {
  ta: ReturnType<typeof useTranslations<'adminInstitutes.actions'>>;
  setActionDialog: (d: ActionDialog) => void;
}) {
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        title={ta('deactivateDescription')}
        onClick={() => setActionDialog({ type: 'deactivate' })}
      >
        <Pause className="size-4" />
        {ta('deactivate')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        title={ta('suspendDescription')}
        onClick={() => setActionDialog({ type: 'suspend', needsReason: true })}
      >
        <ShieldOff className="size-4" />
        {ta('suspend')}
      </Button>
    </>
  );
}

// ── Overview Tab Cards (extracted to reduce cognitive complexity) ──

function ContactCard({
  contact,
  td,
}: {
  contact: NonNullable<NonNullable<InstituteData>['contact']>;
  td: ReturnType<typeof useTranslations<'adminInstitutes.detail'>>;
}) {
  return (
    <Card data-test-id="institute-detail-contact-card">
      <CardHeader>
        <CardTitle data-test-id="institute-detail-contact-title">{td('contact')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {contact.phones.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">{td('phones')}</h4>
            <div className="space-y-1">
              {contact.phones.map((phone) => (
                <div
                  key={`${phone.country_code}${phone.number}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <span>
                    {phone.country_code} {phone.number}
                  </span>
                  {phone.is_primary && <Badge variant="secondary">{td('primary')}</Badge>}
                  {phone.is_whatsapp_enabled && <Badge variant="outline">{td('whatsapp')}</Badge>}
                  {phone.label && <span className="text-muted-foreground">({phone.label})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
        {contact.emails.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">{td('emails')}</h4>
            <div className="space-y-1">
              {contact.emails.map((email) => (
                <div key={email.address} className="flex items-center gap-2 text-sm">
                  <span>{email.address}</span>
                  {email.is_primary && <Badge variant="secondary">{td('primary')}</Badge>}
                  {email.label && <span className="text-muted-foreground">({email.label})</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OverviewTab({
  institute,
  t,
  td,
  resolveI18n,
}: {
  institute: NonNullable<InstituteData>;
  t: ReturnType<typeof useTranslations<'adminInstitutes'>>;
  td: ReturnType<typeof useTranslations<'adminInstitutes.detail'>>;
  resolveI18n: ReturnType<typeof useI18nField>;
}) {
  return (
    <TabsContent value="overview" className="mt-6 space-y-6">
      {/* Identity */}
      <Card data-test-id="institute-detail-identity-card">
        <CardHeader>
          <CardTitle data-test-id="institute-detail-identity-title">{td('identity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">{td('fieldName')}</dt>
              <dd className="font-medium">{resolveI18n(institute.name)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{td('fieldCode')}</dt>
              <dd className="font-mono">{institute.code ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{td('fieldType')}</dt>
              <dd>{t(`types.${institute.type}`)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{td('fieldFramework')}</dt>
              <dd>{institute.structureFramework}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{td('fieldTimezone')}</dt>
              <dd>{institute.timezone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{td('fieldCurrency')}</dt>
              <dd>{institute.currency}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {institute.contact && <ContactCard contact={institute.contact} td={td} />}

      {/* Address */}
      {institute.address && (
        <Card data-test-id="institute-detail-address-card">
          <CardHeader>
            <CardTitle data-test-id="institute-detail-address-title">{td('address')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {[institute.address.line1, institute.address.line2, institute.address.line3]
                .filter(Boolean)
                .join(', ')}
            </p>
            <p className="text-sm">
              {institute.address.city}, {institute.address.district}, {institute.address.state} —{' '}
              {institute.address.postal_code}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Identifiers */}
      {institute.identifiers && institute.identifiers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{td('identifiers')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{td('identifierType')}</TableHead>
                  <TableHead>{td('identifierValue')}</TableHead>
                  <TableHead>{td('identifierIssuedBy')}</TableHead>
                  <TableHead>{td('identifierValidUntil')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {institute.identifiers.map((id) => (
                  <TableRow key={`${id.type}-${id.value}`}>
                    <TableCell className="font-medium">{id.type}</TableCell>
                    <TableCell>{id.value}</TableCell>
                    <TableCell>{id.issuingAuthority ?? '—'}</TableCell>
                    <TableCell>{id.validTo ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Affiliations */}
      {institute.affiliations && institute.affiliations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{td('affiliations')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{td('affiliationBoard')}</TableHead>
                  <TableHead>{td('affiliationStatus')}</TableHead>
                  <TableHead>{td('affiliationNumber')}</TableHead>
                  <TableHead>{td('affiliationLevel')}</TableHead>
                  <TableHead>{td('affiliationValidUntil')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {institute.affiliations.map((aff) => (
                  <TableRow key={`${aff.board}-${aff.affiliationNumber}`}>
                    <TableCell className="font-medium">{aff.board.toUpperCase()}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{aff.affiliationStatus}</Badge>
                    </TableCell>
                    <TableCell>{aff.affiliationNumber ?? '—'}</TableCell>
                    <TableCell>{aff.grantedLevel ?? '—'}</TableCell>
                    <TableCell>{aff.validTo ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
}

// ── Action Confirmation Dialog (extracted to reduce cognitive complexity) ──

function ActionConfirmationDialog({
  actionDialog,
  actionReason,
  setActionDialog,
  setActionReason,
  executeAction,
  ta,
}: {
  actionDialog: ActionDialog;
  actionReason: string;
  setActionDialog: (d: ActionDialog) => void;
  setActionReason: (r: string) => void;
  executeAction: () => void;
  ta: ReturnType<typeof useTranslations<'adminInstitutes.actions'>>;
}) {
  return (
    <AlertDialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{actionDialog ? ta(`${actionDialog.type}Title`) : ''}</AlertDialogTitle>
          <AlertDialogDescription>
            {actionDialog ? ta(`${actionDialog.type}Description`) : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {actionDialog?.needsReason && (
          <Field>
            <FieldLabel>
              {actionDialog.type === 'suspend' ? ta('suspendReason') : ta('rejectTitle')}
            </FieldLabel>
            <Textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder={actionDialog.type === 'suspend' ? ta('suspendReasonPlaceholder') : ''}
              rows={3}
            />
          </Field>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>{ta('cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={executeAction}>{ta('confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function InstituteDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('adminInstitutes');
  const td = useTranslations('adminInstitutes.detail');
  const ta = useTranslations('adminInstitutes.actions');
  const resolveI18n = useI18nField();
  const [activeTab, setActiveTab] = useQueryState('tab', parseAsString.withDefault('overview'));

  const { data, loading, refetch } = useInstitute(params.id);
  const institute = data?.adminGetInstitute;

  // Action mutations
  const [activate] = useActivateInstitute();
  const [deactivate] = useDeactivateInstitute();
  const [suspend] = useSuspendInstitute();
  const [reject] = useRejectInstitute();
  const [deleteInst] = useDeleteInstitute();
  const [restore] = useRestoreInstitute();

  // Breadcrumb label for [id] segment
  const instituteName = institute ? resolveI18n(institute.name) : '';
  useBreadcrumbOverride(instituteName ? { [params.id]: instituteName } : {});

  // Action dialog state
  const [actionDialog, setActionDialog] = React.useState<ActionDialog>(null);
  const [actionReason, setActionReason] = React.useState('');

  const actionMutations: Record<ActionType, (id: string, reason?: string) => Promise<unknown>> = {
    activate: (id) => activate({ variables: { id } }),
    deactivate: (id) => deactivate({ variables: { id } }),
    suspend: (id, reason) => suspend({ variables: { id, reason } }),
    reject: (id, reason) => reject({ variables: { id, reason: reason || 'Rejected' } }),
    delete: (id) => deleteInst({ variables: { id } }),
    restore: (id) => restore({ variables: { id } }),
  };

  const executeAction = async () => {
    if (!institute || !actionDialog) return;
    try {
      await actionMutations[actionDialog.type](institute.id, actionReason || undefined);
      toast.success(ta('success'));
      setActionDialog(null);
      setActionReason('');
      refetch();
    } catch (err) {
      toast.error(ta('error'), { description: extractGraphQLError(err, ta('error')) });
    }
  };

  if (loading && !institute) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!institute) {
    return <p className="py-12 text-center text-muted-foreground">{td('notFound')}</p>;
  }

  const canActivate = institute.setupStatus === 'COMPLETED';
  const showSetupTab = institute.status === 'PENDING' || institute.setupStatus !== 'COMPLETED';

  return (
    <div className="space-y-6" data-test-id="institute-detail-page">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-test-id="institute-detail-title">
            {resolveI18n(institute.name)}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{t(`types.${institute.type}`)}</Badge>
            <Badge variant="outline" className={STATUS_COLOR[institute.status]}>
              {t(`statuses.${institute.status}`)}
            </Badge>
            {institute.code && (
              <span className="font-mono text-xs text-muted-foreground">{institute.code}</span>
            )}
          </div>
        </div>

        <ActionButtons
          institute={institute}
          canActivate={canActivate}
          ta={ta}
          setActionDialog={setActionDialog}
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-test-id="institute-detail-tab-overview">
            {td('tabs.overview')}
          </TabsTrigger>
          {showSetupTab && (
            <TabsTrigger value="setup" data-test-id="institute-detail-tab-setup">
              {td('tabs.setup')}
            </TabsTrigger>
          )}
          <TabsTrigger value="academic" data-test-id="institute-detail-tab-academic">
            {td('tabs.academic')}
          </TabsTrigger>
          <TabsTrigger value="config" data-test-id="institute-detail-tab-config">
            {td('tabs.config')}
          </TabsTrigger>
          <TabsTrigger value="branding" data-test-id="institute-detail-tab-branding">
            {td('tabs.branding')}
          </TabsTrigger>
          <TabsTrigger value="audit" data-test-id="institute-detail-tab-audit">
            {td('tabs.audit')}
          </TabsTrigger>
        </TabsList>

        <OverviewTab institute={institute} t={t} td={td} resolveI18n={resolveI18n} />

        {/* ── Setup Progress Tab ── */}
        {showSetupTab && (
          <TabsContent value="setup" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>{td('setupProgress')}</CardTitle>
              </CardHeader>
              <CardContent>
                {institute.setupStatus === 'COMPLETED' ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="size-5" />
                    <span>{td('setupCompleted')}</span>
                  </div>
                ) : institute.setupStatus === 'FAILED' ? (
                  <div className="flex items-center gap-2 text-red-600">
                    <XCircle className="size-5" />
                    <span>{td('setupFailed', { step: 'unknown' })}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Loader2 className="size-5 animate-spin" />
                    <span>{td('setupProgress')}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Academic Structure Tab ── */}
        <TabsContent value="academic" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{td('academicStructure')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{td('noStandards')}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Configuration Tab ── */}
        <TabsContent value="config" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{td('tabs.config')}</CardTitle>
              <CardDescription>{td('configReadOnly')}</CardDescription>
            </CardHeader>
            <CardContent>
              {institute.config ? (
                <pre className="rounded-lg bg-muted p-4 text-xs">
                  {JSON.stringify(institute.config, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Branding Tab ── */}
        <TabsContent value="branding" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{td('tabs.branding')}</CardTitle>
              <CardDescription>{td('brandingReadOnly')}</CardDescription>
            </CardHeader>
            <CardContent>
              {institute.branding ? (
                <pre className="rounded-lg bg-muted p-4 text-xs">
                  {JSON.stringify(institute.branding, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Audit Tab ── */}
        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{td('tabs.audit')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{td('auditPlaceholder')}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ActionConfirmationDialog
        actionDialog={actionDialog}
        actionReason={actionReason}
        setActionDialog={setActionDialog}
        setActionReason={setActionReason}
        executeAction={executeAction}
        ta={ta}
      />
    </div>
  );
}
