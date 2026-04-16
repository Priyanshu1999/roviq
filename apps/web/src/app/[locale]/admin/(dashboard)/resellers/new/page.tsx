'use client';

import { RESELLER_TIER_VALUES } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { emptyStringToUndefined } from '@roviq/i18n';
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
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCreateReseller } from '../use-resellers';

// ─── Schema ───────────────────────────────────────────────────────────────────

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    name: z.string().min(2, t('create.nameTooShort')).max(255, t('create.nameTooLong')),
    slug: emptyStringToUndefined(
      z
        .string()
        .min(2, t('create.slugInvalid'))
        .max(100, t('create.slugInvalid'))
        .regex(slugPattern, t('create.slugInvalid'))
        .optional(),
    ),
    tier: z.enum(RESELLER_TIER_VALUES, { error: t('create.tierRequired') }),
    initialAdminEmail: z
      .string()
      .email(t('create.emailInvalid'))
      .max(320, t('create.emailInvalid')),
    customDomain: emptyStringToUndefined(z.string().optional()),
    branding: z.object({
      logoUrl: emptyStringToUndefined(z.string().optional()),
      faviconUrl: emptyStringToUndefined(z.string().optional()),
      primaryColor: emptyStringToUndefined(z.string().optional()),
      secondaryColor: emptyStringToUndefined(z.string().optional()),
    }),
  });
}

type ResellerSchema = ReturnType<typeof buildSchema>;
type CreateResellerFormValues = z.input<ResellerSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewResellerPage() {
  const t = useTranslations('adminResellers');
  const router = useRouter();
  const [createReseller] = useCreateReseller();

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: {
      name: '',
      slug: '',
      // First tier is the default selection — must be a valid enum value so
      // the schema's required-tier check doesn't fire on the first submit.
      tier: RESELLER_TIER_VALUES[0],
      initialAdminEmail: '',
      customDomain: '',
      branding: {
        logoUrl: '',
        faviconUrl: '',
        primaryColor: '',
        secondaryColor: '',
      },
    } satisfies CreateResellerFormValues,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        const input = {
          name: parsed.name,
          tier: parsed.tier,
          initialAdminEmail: parsed.initialAdminEmail,
          ...(parsed.slug ? { slug: parsed.slug } : {}),
          ...(parsed.customDomain ? { customDomain: parsed.customDomain } : {}),
          branding: {
            ...(parsed.branding?.logoUrl ? { logoUrl: parsed.branding.logoUrl } : {}),
            ...(parsed.branding?.faviconUrl ? { faviconUrl: parsed.branding.faviconUrl } : {}),
            ...(parsed.branding?.primaryColor
              ? { primaryColor: parsed.branding.primaryColor }
              : {}),
            ...(parsed.branding?.secondaryColor
              ? { secondaryColor: parsed.branding.secondaryColor }
              : {}),
          },
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

  return (
    <div className="space-y-6" data-testid="new-reseller-page">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/resellers')}
          data-testid="back-to-resellers-btn"
        >
          <ArrowLeft className="me-1 size-4" />
          {t('title')}
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="new-reseller-title">
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
        data-testid="create-reseller-form"
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
            data-testid="cancel-create-reseller-btn"
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
