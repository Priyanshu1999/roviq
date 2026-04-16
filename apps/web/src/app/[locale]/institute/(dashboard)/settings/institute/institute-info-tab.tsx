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
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  I18nField,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useAppForm,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { AddressForm } from './components/address-form';
import { ContactBuilder } from './components/contact-builder';
import { type InstituteInfoFormValues, instituteInfoSchema } from './schemas';
import type { MyInstituteData } from './types';
import { useUpdateInstituteInfo } from './use-institute-settings';

/** Check if a GraphQL error is a CONCURRENT_MODIFICATION error code. */
function isConcurrentModificationError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'graphQLErrors' in err) {
    const gqlErrors = (err as { graphQLErrors: Array<{ extensions?: Record<string, unknown> }> })
      .graphQLErrors;
    return gqlErrors.some(
      (e) =>
        (e.extensions?.originalError as { error?: string } | undefined)?.error ===
        'CONCURRENT_MODIFICATION',
    );
  }
  return false;
}

interface InstituteInfoTabProps {
  institute: MyInstituteData['myInstitute'] | undefined;
  loading: boolean;
  refetch: () => void;
}

const DEFAULT_VALUES: InstituteInfoFormValues = {
  name: { en: '' },
  code: '',
  contact: {
    phones: [
      {
        countryCode: '+91',
        number: '',
        isPrimary: true,
        isWhatsappEnabled: true,
        label: '',
      },
    ],
    emails: [],
  },
  address: {
    line1: '',
    line2: '',
    line3: '',
    city: '',
    district: '',
    state: '',
    postalCode: '',
    country: 'IN',
  },
  version: 0,
};

export function InstituteInfoTab({ institute, loading, refetch }: InstituteInfoTabProps) {
  const t = useTranslations('instituteSettings');
  const ti = useTranslations('instituteSettings.info');
  const [concurrentError, setConcurrentError] = React.useState(false);
  const [updateInfo] = useUpdateInstituteInfo();

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onChange: instituteInfoSchema, onSubmit: instituteInfoSchema },
    onSubmit: async ({ value }) => {
      if (!institute) return;
      setConcurrentError(false);

      try {
        await updateInfo({
          variables: {
            id: institute.id,
            input: {
              version: value.version,
              name: value.name,
              // code is read-only — never submitted
              contact: value.contact,
              address: value.address,
            },
          },
        });
        toast.success(t('saved'));
      } catch (err) {
        if (isConcurrentModificationError(err)) {
          setConcurrentError(true);
        } else {
          const message = extractGraphQLError(err, t('saveFailed'));
          toast.error(t('saveFailed'), { description: message });
        }
      }
    },
  });

  const isDirty = useStore(form.store, (state) => state.isDirty);

  // Dispatch dirty state to parent for beforeunload guard
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('institute-form-dirty', { detail: { dirty: isDirty } }));
  }, [isDirty]);

  // Sync form with fetched data — all keys are camelCase matching Drizzle/GraphQL
  React.useEffect(() => {
    if (!institute) return;
    form.reset(
      {
        name: (institute.name as Record<string, string>) ?? { en: '' },
        code: institute.code ?? '',
        contact: institute.contact ?? {
          phones: [
            {
              countryCode: '+91',
              number: '',
              isPrimary: true,
              isWhatsappEnabled: true,
              label: '',
            },
          ],
          emails: [],
        },
        address: institute.address ?? {
          line1: '',
          line2: '',
          line3: '',
          city: '',
          district: '',
          state: '',
          postalCode: '',
          country: 'IN',
        },
        version: institute.version ?? 0,
      },
      { keepDefaultValues: true },
    );
    setConcurrentError(false);
  }, [institute, form]);

  const code = useStore(
    form.store,
    (state) => (state.values as InstituteInfoFormValues).code ?? '',
  );

  if (loading && !institute) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <Can I="update_info" a="Institute" passThrough>
      {(allowed: boolean) => (
        <div className="space-y-6">
          {/* Concurrent modification banner */}
          {concurrentError && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <AlertTriangle className="size-5 shrink-0 text-amber-600" />
              <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
                {t('refreshToSeeLatest')}
              </p>
              <Button
                data-testid="settings-info-refresh-btn"
                variant="outline"
                size="sm"
                onClick={() => {
                  refetch();
                  setConcurrentError(false);
                }}
              >
                <RefreshCw className="size-4" />
                {t('refresh')}
              </Button>
            </div>
          )}

          {/* Info form */}
          <Card>
            <CardHeader>
              <CardTitle>{ti('title')}</CardTitle>
              <CardDescription>{ti('description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void form.handleSubmit();
                }}
              >
                <fieldset disabled={!allowed}>
                  <FieldGroup>
                    <I18nField
                      form={form}
                      name="name"
                      label={ti('name')}
                      placeholder={ti('namePlaceholder')}
                      testId="settings-info-name"
                    />

                    {/* Code — read-only, never submitted */}
                    <Field>
                      <FieldLabel htmlFor="institute-code">{ti('code')}</FieldLabel>
                      <Input
                        id="institute-code"
                        data-testid="settings-info-code-input"
                        value={code}
                        readOnly
                        aria-readonly="true"
                        className="bg-muted text-muted-foreground cursor-default"
                      />
                      <FieldDescription>{ti('codeDescription')}</FieldDescription>
                    </Field>

                    {/* Institute type — read-only display */}
                    {institute?.type && (
                      <Field>
                        <FieldLabel>{ti('type')}</FieldLabel>
                        <div>
                          <Badge variant="secondary">
                            {ti(`typeOptions.${institute.type.toLowerCase()}`)}
                          </Badge>
                        </div>
                        <FieldDescription>{ti('typeDescription')}</FieldDescription>
                      </Field>
                    )}

                    {/* Departments — read-only badges */}
                    <Field>
                      <FieldLabel>{ti('departments')}</FieldLabel>
                      <FieldDescription>{ti('departmentsDescription')}</FieldDescription>
                      <div className="flex flex-wrap gap-2">
                        {institute?.departments && institute.departments.length > 0 ? (
                          institute.departments.map((dept) => (
                            <Badge key={dept} variant="secondary">
                              {ti(`departmentOptions.${dept.toLowerCase()}`)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </Field>

                    <FieldSeparator>{ti('contact')}</FieldSeparator>
                    <FieldDescription>{ti('contactDescription')}</FieldDescription>
                    <ContactBuilder form={form} />

                    <FieldSeparator>{ti('address')}</FieldSeparator>
                    <FieldDescription>{ti('addressDescription')}</FieldDescription>
                    <AddressForm form={form} />
                  </FieldGroup>

                  {allowed && (
                    <div className="mt-6 flex justify-end">
                      <form.AppForm>
                        <form.SubmitButton
                          testId="settings-info-save-btn"
                          disabled={!isDirty}
                          submittingLabel={t('saving')}
                        >
                          {t('save')}
                        </form.SubmitButton>
                      </form.AppForm>
                    </div>
                  )}
                </fieldset>
              </form>
            </CardContent>
          </Card>

          {/* Read-only: Regulatory Identifiers */}
          {institute?.identifiers && institute.identifiers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{ti('identifiers')}</CardTitle>
                <CardDescription>{ti('identifiersDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{ti('identifierType')}</TableHead>
                      <TableHead>{ti('identifierValue')}</TableHead>
                      <TableHead>{ti('identifierIssuedBy')}</TableHead>
                      <TableHead>{ti('identifierValidUntil')}</TableHead>
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

          {/* Read-only: Affiliations */}
          {institute?.affiliations && institute.affiliations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{ti('affiliations')}</CardTitle>
                <CardDescription>{ti('affiliationsDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{ti('affiliationBoard')}</TableHead>
                      <TableHead>{ti('affiliationStatus')}</TableHead>
                      <TableHead>{ti('affiliationNumber')}</TableHead>
                      <TableHead>{ti('affiliationGrantedLevel')}</TableHead>
                      <TableHead>{ti('affiliationValidFrom')}</TableHead>
                      <TableHead>{ti('affiliationValidUntil')}</TableHead>
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
                        <TableCell>{aff.validFrom ?? '—'}</TableCell>
                        <TableCell>{aff.validTo ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {!allowed && <p className="text-sm text-muted-foreground">{t('noPermission')}</p>}
        </div>
      )}
    </Can>
  );
}
