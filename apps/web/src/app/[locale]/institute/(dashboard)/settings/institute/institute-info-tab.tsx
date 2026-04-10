'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  I18nInput,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@roviq/ui';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { FormProvider, type Resolver, useForm } from 'react-hook-form';
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

export function InstituteInfoTab({ institute, loading, refetch }: InstituteInfoTabProps) {
  const t = useTranslations('instituteSettings');
  const ti = useTranslations('instituteSettings.info');
  const [concurrentError, setConcurrentError] = React.useState(false);
  const [updateInfo] = useUpdateInstituteInfo();

  const form = useForm<InstituteInfoFormValues>({
    resolver: zodResolver(instituteInfoSchema) as Resolver<InstituteInfoFormValues>,
    defaultValues: {
      name: { en: '' },
      code: '',
      contact: {
        phones: [
          {
            country_code: '+91',
            number: '',
            is_primary: true,
            is_whatsapp_enabled: true,
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
        postal_code: '',
        country: 'IN',
      },
      version: 0,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  // Dispatch dirty state to parent for beforeunload guard
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('institute-form-dirty', { detail: { dirty: isDirty } }));
  }, [isDirty]);

  // Sync form with fetched data
  React.useEffect(() => {
    if (!institute) return;
    reset({
      name: (institute.name as Record<string, string>) ?? { en: '' },
      code: institute.code ?? '',
      contact: institute.contact ?? {
        phones: [
          {
            country_code: '+91',
            number: '',
            is_primary: true,
            is_whatsapp_enabled: true,
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
        postal_code: '',
        country: 'IN',
      },
      version: institute.version ?? 0,
    });
    setConcurrentError(false);
  }, [institute, reset]);

  const onSubmit = async (values: InstituteInfoFormValues) => {
    if (!institute) return;
    setConcurrentError(false);

    try {
      await updateInfo({
        variables: {
          id: institute.id,
          input: {
            version: values.version,
            name: values.name,
            code: values.code || undefined,
            contact: values.contact,
            address: values.address,
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
  };

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
              <FormProvider {...form}>
                <form onSubmit={handleSubmit(onSubmit)}>
                  <fieldset disabled={!allowed || isSubmitting}>
                    <FieldGroup>
                      <I18nInput<InstituteInfoFormValues>
                        name="name"
                        label={ti('name')}
                        required
                        placeholder={ti('namePlaceholder')}
                      />

                      <Field data-invalid={!!errors.code}>
                        <FieldLabel htmlFor="institute-code">{ti('code')}</FieldLabel>
                        <Input
                          id="institute-code"
                          {...register('code')}
                          placeholder={ti('codePlaceholder')}
                          aria-invalid={!!errors.code}
                        />
                        {errors.code && <FieldError errors={[errors.code]} />}
                      </Field>

                      {/* Departments (read-only display) */}
                      <Field>
                        <FieldLabel>{ti('departments')}</FieldLabel>
                        <FieldDescription>{ti('departmentsDescription')}</FieldDescription>
                        <div className="flex flex-wrap gap-2">
                          {institute?.departments && institute.departments.length > 0 ? (
                            institute.departments.map((dept) => (
                              <Badge key={dept} variant="secondary">
                                {ti(`departmentOptions.${dept}`)}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                      </Field>

                      <FieldSeparator>{ti('contact')}</FieldSeparator>
                      <FieldDescription>{ti('contactDescription')}</FieldDescription>
                      <ContactBuilder />

                      <FieldSeparator>{ti('address')}</FieldSeparator>
                      <FieldDescription>{ti('addressDescription')}</FieldDescription>
                      <AddressForm />
                    </FieldGroup>

                    {allowed && (
                      <div className="mt-6 flex justify-end">
                        <Button type="submit" disabled={!isDirty || isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <Loader2 className="size-4 animate-spin" />
                              {t('saving')}
                            </>
                          ) : (
                            t('save')
                          )}
                        </Button>
                      </div>
                    )}
                  </fieldset>
                </form>
              </FormProvider>
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
