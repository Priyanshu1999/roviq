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
  const [actionDialog, setActionDialog] = React.useState<{
    type: 'activate' | 'deactivate' | 'suspend' | 'reject' | 'delete' | 'restore';
    needsReason?: boolean;
  } | null>(null);
  const [actionReason, setActionReason] = React.useState('');

  const executeAction = async () => {
    if (!institute) return;
    try {
      switch (actionDialog?.type) {
        case 'activate':
          await activate({ variables: { id: institute.id } });
          break;
        case 'deactivate':
          await deactivate({ variables: { id: institute.id } });
          break;
        case 'suspend':
          await suspend({ variables: { id: institute.id, reason: actionReason || undefined } });
          break;
        case 'reject':
          await reject({ variables: { id: institute.id, reason: actionReason || 'Rejected' } });
          break;
        case 'delete':
          await deleteInst({ variables: { id: institute.id } });
          break;
        case 'restore':
          await restore({ variables: { id: institute.id } });
          break;
      }
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{resolveI18n(institute.name)}</h1>
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

        {/* Action buttons */}
        <div className="flex gap-2">
          {institute.status === 'INACTIVE' && (
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
          )}
          {institute.status === 'ACTIVE' && (
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
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{td('tabs.overview')}</TabsTrigger>
          {showSetupTab && <TabsTrigger value="setup">{td('tabs.setup')}</TabsTrigger>}
          <TabsTrigger value="academic">{td('tabs.academic')}</TabsTrigger>
          <TabsTrigger value="config">{td('tabs.config')}</TabsTrigger>
          <TabsTrigger value="branding">{td('tabs.branding')}</TabsTrigger>
          <TabsTrigger value="audit">{td('tabs.audit')}</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Identity */}
          <Card>
            <CardHeader>
              <CardTitle>{td('identity')}</CardTitle>
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

          {/* Contact */}
          {institute.contact && (
            <Card>
              <CardHeader>
                <CardTitle>{td('contact')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {institute.contact.phones.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                      {td('phones')}
                    </h4>
                    <div className="space-y-1">
                      {institute.contact.phones.map((phone) => (
                        <div
                          key={`${phone.country_code}${phone.number}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span>
                            {phone.country_code} {phone.number}
                          </span>
                          {phone.is_primary && <Badge variant="secondary">{td('primary')}</Badge>}
                          {phone.is_whatsapp_enabled && (
                            <Badge variant="outline">{td('whatsapp')}</Badge>
                          )}
                          {phone.label && (
                            <span className="text-muted-foreground">({phone.label})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {institute.contact.emails.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                      {td('emails')}
                    </h4>
                    <div className="space-y-1">
                      {institute.contact.emails.map((email) => (
                        <div key={email.address} className="flex items-center gap-2 text-sm">
                          <span>{email.address}</span>
                          {email.is_primary && <Badge variant="secondary">{td('primary')}</Badge>}
                          {email.label && (
                            <span className="text-muted-foreground">({email.label})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Address */}
          {institute.address && (
            <Card>
              <CardHeader>
                <CardTitle>{td('address')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {[institute.address.line1, institute.address.line2, institute.address.line3]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                <p className="text-sm">
                  {institute.address.city}, {institute.address.district}, {institute.address.state}{' '}
                  — {institute.address.postal_code}
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
                        <TableCell>{id.issuedBy ?? '—'}</TableCell>
                        <TableCell>{id.validUntil ?? '—'}</TableCell>
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

      {/* Action confirmation dialog */}
      <AlertDialog open={!!actionDialog} onOpenChange={(o) => !o && setActionDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionDialog ? ta(`${actionDialog.type}Title`) : ''}
            </AlertDialogTitle>
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
    </div>
  );
}
