'use client';

import { extractGraphQLError } from '@roviq/graphql';
import type { InstituteStatus } from '@roviq/graphql/generated';
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
  Can,
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
  useBreadcrumbOverride,
} from '@roviq/ui';
import { AlertTriangle, Loader2, Pause, Play } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';
import * as React from 'react';
import { toast } from 'sonner';
import {
  useResellerInstitute,
  useResellerReactivateInstitute,
  useResellerSuspendInstitute,
} from '../use-reseller-institutes';

const STATUS_COLOR: Record<InstituteStatus, string> = {
  /** Awaiting platform admin approval after reseller request. */
  PENDING_APPROVAL: 'border-amber-300 text-amber-700',
  /** Approved but setup not yet complete. */
  PENDING: 'bg-blue-100 text-blue-700',
  /** Fully operational institute. */
  ACTIVE: 'bg-green-100 text-green-700',
  /** Temporarily deactivated by admin or reseller. */
  INACTIVE: 'bg-gray-100 text-gray-600',
  /** Suspended due to policy violation or non-payment. */
  SUSPENDED: 'bg-red-100 text-red-700',
  /** Rejected by platform admin during approval. */
  REJECTED: 'line-through opacity-60',
};

export default function ResellerInstituteDetailPage() {
  const params = useParams<{ id: string }>();
  const t = useTranslations('resellerInstitutes');
  const td = useTranslations('resellerInstitutes.detail');
  const ta = useTranslations('resellerInstitutes.actions');
  const resolveI18n = useI18nField();
  const [activeTab, setActiveTab] = useQueryState('tab', parseAsString.withDefault('overview'));

  const { data, loading, refetch } = useResellerInstitute(params.id);
  const institute = data?.resellerGetInstitute;

  const [suspendInst] = useResellerSuspendInstitute();
  const [reactivateInst] = useResellerReactivateInstitute();

  const [actionType, setActionType] = React.useState<'suspend' | 'reactivate' | null>(null);
  const [suspendReason, setSuspendReason] = React.useState('');

  // Set breadcrumb label for the [id] segment — must be before early returns
  const instituteName = institute ? resolveI18n(institute.name) : '';
  useBreadcrumbOverride(instituteName ? { [params.id]: instituteName } : {});

  const executeAction = async () => {
    if (!institute) return;
    try {
      if (actionType === 'suspend') {
        await suspendInst({ variables: { id: institute.id } });
      } else {
        await reactivateInst({ variables: { id: institute.id } });
      }
      toast.success(ta('success'));
      setActionType(null);
      setSuspendReason('');
      refetch();
    } catch (err) {
      toast.error(ta('error'), {
        description: extractGraphQLError(err, ta('error')),
      });
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
        <Can I="update_status" a="Institute">
          <div className="flex gap-2">
            {institute.status === 'ACTIVE' && (
              <Button variant="outline" size="sm" onClick={() => setActionType('suspend')}>
                <Pause className="size-4" />
                {ta('suspend')}
              </Button>
            )}
            {(institute.status === 'INACTIVE' || institute.status === 'SUSPENDED') && (
              <Button variant="outline" size="sm" onClick={() => setActionType('reactivate')}>
                <Play className="size-4" />
                {ta('reactivate')}
              </Button>
            )}
          </div>
        </Can>
      </div>

      {/* Pending approval banner */}
      {institute.status === 'PENDING_APPROVAL' && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-200">{t('pendingBanner')}</p>
        </div>
      )}

      {institute.status === 'PENDING' && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <Loader2 className="size-5 shrink-0 animate-spin text-blue-600" />
          <p className="text-sm text-blue-800 dark:text-blue-200">{t('setupBanner')}</p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{td('tabs.overview')}</TabsTrigger>
          <TabsTrigger value="academic">{td('tabs.academic')}</TabsTrigger>
          <TabsTrigger value="compliance">{td('tabs.compliance')}</TabsTrigger>
          <TabsTrigger value="users">{td('tabs.users')}</TabsTrigger>
          <TabsTrigger value="audit">{td('tabs.audit')}</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="mt-6 space-y-6">
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
                  <dd className="font-mono">{institute.code ?? '\u2014'}</dd>
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
                <div>
                  <dt className="text-muted-foreground">{td('groupInfo')}</dt>
                  <dd>{institute.groupName ?? td('noGroup')}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

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
                          key={`${phone.countryCode}${phone.number}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span>
                            {phone.countryCode} {phone.number}
                          </span>
                          {phone.isPrimary && <Badge variant="secondary">{td('primary')}</Badge>}
                          {phone.isWhatsappEnabled && (
                            <Badge variant="outline">{td('whatsapp')}</Badge>
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
                          {email.isPrimary && <Badge variant="secondary">{td('primary')}</Badge>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                  — {institute.address.postalCode}
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
                        <TableCell>{id.issuingAuthority ?? '\u2014'}</TableCell>
                        <TableCell>{id.validTo ?? '\u2014'}</TableCell>
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
                        <TableCell>{aff.affiliationNumber ?? '\u2014'}</TableCell>
                        <TableCell>{aff.grantedLevel ?? '\u2014'}</TableCell>
                        <TableCell>{aff.validTo ?? '\u2014'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Academic Tab ── */}
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

        {/* ── Compliance Tab ── */}
        <TabsContent value="compliance" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{td('complianceData')}</CardTitle>
              <CardDescription>{td('complianceDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{td('noComplianceData')}</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Users Tab ── */}
        <TabsContent value="users" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{td('usersList')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{td('noUsers')}</p>
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

      {/* Action dialog */}
      <AlertDialog open={!!actionType} onOpenChange={(o) => !o && setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'suspend' ? ta('suspendTitle') : ta('reactivateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'suspend' ? ta('suspendDescription') : ta('reactivateDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {actionType === 'suspend' && (
            <Field>
              <FieldLabel>{ta('suspendReason')}</FieldLabel>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder={ta('suspendReasonPlaceholder')}
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
