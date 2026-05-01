'use client';

import { RESELLER_TIER_VALUES } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { emptyStringToUndefined, zodValidator } from '@roviq/i18n';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldGroup,
  useAppForm,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  compactBranding,
  FQDN_RE,
  HEX_COLOR_RE,
  HTTP_URL_RE,
  SLUG_RE,
} from '../reseller-validators';
import { useCreateReseller } from '../use-resellers';

const { adminResellerCreate } = testIds;
// ─── Schema ───────────────────────────────────────────────────────────────────

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    name: z.string().min(2, t('create.nameTooShort')).max(255, t('create.nameTooLong')),
    slug: emptyStringToUndefined(
      z
        .string()
        .min(2, t('create.slugTooShort'))
        .max(100, t('create.slugTooLong'))
        .regex(SLUG_RE, t('create.slugInvalid'))
        .optional(),
    ),
    tier: z.enum(RESELLER_TIER_VALUES, { error: t('create.tierRequired') }),
    initialAdminEmail: z
      .string()
      .email(t('create.emailInvalid'))
      .max(320, t('create.emailInvalid')),
    customDomain: emptyStringToUndefined(
      z.string().max(255).regex(FQDN_RE, t('create.domainInvalid')).optional(),
    ),
    branding: z.object({
      logoUrl: emptyStringToUndefined(
        z.string().regex(HTTP_URL_RE, t('create.urlInvalid')).optional(),
      ),
      faviconUrl: emptyStringToUndefined(
        z.string().regex(HTTP_URL_RE, t('create.urlInvalid')).optional(),
      ),
      primaryColor: emptyStringToUndefined(
        z.string().regex(HEX_COLOR_RE, t('create.colorInvalid')).optional(),
      ),
      secondaryColor: emptyStringToUndefined(
        z.string().regex(HEX_COLOR_RE, t('create.colorInvalid')).optional(),
      ),
    }),
  });
}

type ResellerSchema = ReturnType<typeof buildSchema>;
type CreateResellerFormValues = z.input<ResellerSchema>;

const EMPTY_DEFAULTS: CreateResellerFormValues = {
  name: '',
  slug: '',
  // First tier is the default selection — must be a valid enum value so the
  // schema's required-tier check doesn't fire on the first submit.
  tier: RESELLER_TIER_VALUES[0],
  initialAdminEmail: '',
  customDomain: '',
  branding: {
    logoUrl: '',
    faviconUrl: '',
    primaryColor: '',
    secondaryColor: '',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewResellerPage() {
  const t = useTranslations('adminResellers');
  const router = useRouter();
  const [createReseller] = useCreateReseller();

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: EMPTY_DEFAULTS,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        const branding = compactBranding(parsed.branding);
        const input = {
          name: parsed.name,
          tier: parsed.tier,
          initialAdminEmail: parsed.initialAdminEmail,
          ...(parsed.slug ? { slug: parsed.slug } : {}),
          ...(parsed.customDomain ? { customDomain: parsed.customDomain } : {}),
          ...(branding ? { branding } : {}),
        };

        const result = await createReseller({ variables: { input } });
        const id = result.data?.adminCreateReseller.id;
        toast.success(t('create.success'));
        router.push(id ? `/admin/resellers/${id}` : '/admin/resellers');
      } catch (err) {
        toast.error(extractGraphQLError(err, t('create.error')));
      }
    },
  });

  const tierOptions = RESELLER_TIER_VALUES.map((tier) => ({
    value: tier,
    label: t(`tiers.${tier}`),
  }));

  // Dirty-state guard: warn the user before navigating away with unsaved
  // changes. Native `beforeunload` covers tab close / reload / external
  // navigation. Intra-app router.push is handled by the submit path and the
  // Cancel button (explicit user intent — no prompt needed).
  const isDirty = useStore(form.store, (s) => s.isDirty);
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting);
  const isSubmitted = useStore(form.store, (s) => s.isSubmitted);

  React.useEffect(() => {
    const shouldGuard = isDirty && !isSubmitting && !isSubmitted;
    if (!shouldGuard) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers require returnValue to trigger the prompt; modern
      // ones ignore the message and show a generic one.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty, isSubmitting, isSubmitted]);

  return (
    <div className="space-y-6" data-testid={adminResellerCreate.page}>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/resellers')}
          data-testid={adminResellerCreate.backBtn}
        >
          <ArrowLeft className="me-1 size-4" />
          {t('title')}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid={adminResellerCreate.title}>
          {t('create.title')}
        </h1>
        <p className="text-muted-foreground">{t('create.description')}</p>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-6"
        data-testid={adminResellerCreate.form}
      >
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle>{t('create.sections.identity')}</CardTitle>
            <CardDescription>{t('create.sections.identityDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <form.AppField name="name">
                {(field) => (
                  <field.TextField
                    label={t('create.name')}
                    description={t('create.nameDescription')}
                    placeholder={t('create.namePlaceholder')}
                    testId="reseller-name-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="slug">
                {(field) => (
                  <field.TextField
                    label={t('create.slug')}
                    description={t('create.slugDescription')}
                    placeholder={t('create.slugPlaceholder')}
                    testId="reseller-slug-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="tier">
                {(field) => (
                  <field.SelectField
                    label={t('create.tier')}
                    description={t('create.tierDescription')}
                    options={tierOptions}
                    placeholder={t('create.tierPlaceholder')}
                    testId="reseller-tier-select"
                    optional={false}
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Initial Admin */}
        <Card>
          <CardHeader>
            <CardTitle>{t('create.sections.admin')}</CardTitle>
            <CardDescription>{t('create.sections.adminDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <form.AppField name="initialAdminEmail">
                {(field) => (
                  <field.TextField
                    label={t('create.initialAdminEmail')}
                    description={t('create.initialAdminEmailDescription')}
                    placeholder={t('create.initialAdminEmailPlaceholder')}
                    type="email"
                    testId="reseller-admin-email-input"
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* Branding (optional) */}
        <Card>
          <CardHeader>
            <CardTitle>{t('create.sections.branding')}</CardTitle>
            <CardDescription>{t('create.sections.brandingDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <form.AppField name="branding.logoUrl">
                  {(field) => (
                    <field.TextField
                      label={t('create.brandingLogoUrl')}
                      placeholder={t('create.brandingLogoUrlPlaceholder')}
                      testId="reseller-logo-url-input"
                    />
                  )}
                </form.AppField>

                <form.AppField name="branding.faviconUrl">
                  {(field) => (
                    <field.TextField
                      label={t('create.brandingFaviconUrl')}
                      placeholder={t('create.brandingFaviconUrlPlaceholder')}
                      testId="reseller-favicon-url-input"
                    />
                  )}
                </form.AppField>

                <form.AppField name="branding.primaryColor">
                  {(field) => (
                    <field.TextField
                      label={t('create.brandingPrimaryColor')}
                      placeholder={t('create.brandingPrimaryColorPlaceholder')}
                      testId="reseller-primary-color-input"
                    />
                  )}
                </form.AppField>

                <form.AppField name="branding.secondaryColor">
                  {(field) => (
                    <field.TextField
                      label={t('create.brandingSecondaryColor')}
                      placeholder={t('create.brandingSecondaryColorPlaceholder')}
                      testId="reseller-secondary-color-input"
                    />
                  )}
                </form.AppField>
              </div>

              <form.AppField name="customDomain">
                {(field) => (
                  <field.TextField
                    label={t('create.customDomain')}
                    description={t('create.customDomainDescription')}
                    placeholder={t('create.customDomainPlaceholder')}
                    testId="reseller-custom-domain-input"
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/resellers')}
            data-testid={adminResellerCreate.cancelBtn}
          >
            {t('actions.cancel')}
          </Button>
          <form.AppForm>
            <form.SubmitButton
              testId="submit-create-reseller-btn"
              submittingLabel={t('create.creating')}
            >
              {t('create.submit')}
            </form.SubmitButton>
          </form.AppForm>
        </div>
      </form>
    </div>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
