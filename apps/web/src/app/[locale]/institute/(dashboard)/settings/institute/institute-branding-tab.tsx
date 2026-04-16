'use client';

import { extractGraphQLError } from '@roviq/graphql';
import {
  Badge,
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
  Skeleton,
  useAppForm,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { BrandingPreview } from './components/branding-preview';
import { type InstituteBrandingFormValues, instituteBrandingSchema } from './schemas';
import type { MyInstituteData } from './types';
import { useUpdateInstituteBranding } from './use-institute-settings';

const THEME_OPTIONS = ['default', 'classic', 'modern', 'minimal'] as const;

interface InstituteBrandingTabProps {
  institute: MyInstituteData['myInstitute'] | undefined;
  loading: boolean;
}

const DEFAULT_VALUES: InstituteBrandingFormValues = {
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#1e40af',
  secondaryColor: '#e2e8f0',
  themeIdentifier: 'default',
  coverImageUrl: '',
};

export function InstituteBrandingTab({ institute, loading }: InstituteBrandingTabProps) {
  const t = useTranslations('instituteSettings');
  const tb = useTranslations('instituteSettings.branding');
  const [updateBranding] = useUpdateInstituteBranding();

  const branding = institute?.branding;

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onChange: instituteBrandingSchema, onSubmit: instituteBrandingSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateBranding({
          variables: {
            input: {
              logoUrl: value.logoUrl || undefined,
              faviconUrl: value.faviconUrl || undefined,
              primaryColor: value.primaryColor || undefined,
              secondaryColor: value.secondaryColor || undefined,
              themeIdentifier: value.themeIdentifier || undefined,
              coverImageUrl: value.coverImageUrl || undefined,
            },
          },
        });
        toast.success(t('saved'));
      } catch (err) {
        toast.error(t('saveFailed'), {
          description: extractGraphQLError(err, t('saveFailed')),
        });
      }
    },
  });

  const isDirty = useStore(form.store, (state) => state.isDirty);
  const primaryColor = useStore(
    form.store,
    (state) => (state.values as InstituteBrandingFormValues).primaryColor || '#1e40af',
  );
  const secondaryColor = useStore(
    form.store,
    (state) => (state.values as InstituteBrandingFormValues).secondaryColor || '#e2e8f0',
  );

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent('institute-form-dirty', { detail: { dirty: isDirty } }));
  }, [isDirty]);

  React.useEffect(() => {
    if (!branding) return;
    form.reset(
      {
        logoUrl: branding.logoUrl ?? '',
        faviconUrl: branding.faviconUrl ?? '',
        primaryColor: branding.primaryColor ?? '#1e40af',
        secondaryColor: branding.secondaryColor ?? '#e2e8f0',
        themeIdentifier: branding.themeIdentifier ?? 'default',
        coverImageUrl: branding.coverImageUrl ?? '',
      },
      { keepDefaultValues: true },
    );
  }, [branding, form]);

  const themeOptions = THEME_OPTIONS.map((theme) => ({
    value: theme,
    label: tb(`themeOptions.${theme}`),
  }));

  if (loading && !institute) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <Can I="update_branding" a="Institute" passThrough>
      {(allowed: boolean) => (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader>
              <CardTitle>{tb('title')}</CardTitle>
              <CardDescription>{tb('description')}</CardDescription>
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
                    <form.AppField name="logoUrl">
                      {(field) => (
                        <field.TextField
                          label={tb('logo')}
                          description={tb('logoUrlDescription')}
                          type="url"
                          placeholder={tb('urlPlaceholder')}
                          testId="branding-logo-url-input"
                        />
                      )}
                    </form.AppField>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {t('uploadComingSoon')}
                    </Badge>

                    <form.AppField name="faviconUrl">
                      {(field) => (
                        <field.TextField
                          label={tb('favicon')}
                          description={tb('faviconUrlDescription')}
                          type="url"
                          placeholder={tb('urlPlaceholder')}
                          testId="branding-favicon-url-input"
                        />
                      )}
                    </form.AppField>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {t('uploadComingSoon')}
                    </Badge>

                    <div className="grid grid-cols-2 gap-4">
                      <Field>
                        <FieldLabel>{tb('primaryColor')}</FieldLabel>
                        <FieldDescription>{tb('primaryColorDescription')}</FieldDescription>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={primaryColor}
                            onChange={(e) => form.setFieldValue('primaryColor', e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border-0"
                            aria-label={tb('primaryColor')}
                            data-testid="branding-primary-color-picker"
                          />
                          <form.AppField name="primaryColor">
                            {(field) => (
                              <field.TextField
                                label=""
                                placeholder="#1e40af"
                                testId="branding-primary-color-input"
                              />
                            )}
                          </form.AppField>
                        </div>
                      </Field>

                      <Field>
                        <FieldLabel>{tb('secondaryColor')}</FieldLabel>
                        <FieldDescription>{tb('secondaryColorDescription')}</FieldDescription>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={secondaryColor}
                            onChange={(e) => form.setFieldValue('secondaryColor', e.target.value)}
                            className="h-8 w-10 cursor-pointer rounded border-0"
                            aria-label={tb('secondaryColor')}
                            data-testid="branding-secondary-color-picker"
                          />
                          <form.AppField name="secondaryColor">
                            {(field) => (
                              <field.TextField
                                label=""
                                placeholder="#e2e8f0"
                                testId="branding-secondary-color-input"
                              />
                            )}
                          </form.AppField>
                        </div>
                      </Field>
                    </div>

                    <form.AppField name="themeIdentifier">
                      {(field) => (
                        <field.SelectField
                          label={tb('theme')}
                          description={tb('themeDescription')}
                          options={themeOptions}
                          optional={false}
                          testId="branding-theme-select"
                        />
                      )}
                    </form.AppField>

                    <form.AppField name="coverImageUrl">
                      {(field) => (
                        <field.TextField
                          label={tb('coverImage')}
                          description={tb('coverImageUrlDescription')}
                          type="url"
                          placeholder={tb('urlPlaceholder')}
                          testId="branding-cover-url-input"
                        />
                      )}
                    </form.AppField>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {t('uploadComingSoon')}
                    </Badge>
                  </FieldGroup>

                  {allowed && (
                    <div className="mt-6 flex justify-end">
                      <form.AppForm>
                        <form.SubmitButton
                          testId="branding-save-btn"
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

          <div className="hidden lg:block">
            <BrandingPreview form={form} />
          </div>

          {!allowed && <p className="text-sm text-muted-foreground">{t('noPermission')}</p>}
        </div>
      )}
    </Can>
  );
}
