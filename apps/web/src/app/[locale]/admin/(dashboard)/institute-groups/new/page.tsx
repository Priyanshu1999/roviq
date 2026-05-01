'use client';

import { GROUP_TYPE_VALUES, INDIAN_STATE_VALUES, optionalAddressSchema } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { zodValidator } from '@roviq/i18n';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldDescription,
  FieldGroup,
  FieldInfoPopover,
  FieldLegend,
  FieldSet,
  useAppForm,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { AddressForm } from '../../../../institute/(dashboard)/settings/institute/components/address-form';
import { ContactBuilder } from '../../../../institute/(dashboard)/settings/institute/components/contact-builder';
import { useCreateInstituteGroup } from '../use-institute-groups';

const { adminInstituteGroups } = testIds;
// ─── Constants ──────────────────────────────────────────────────────────────

/** localStorage key for draft auto-save (see [HUPGP]). */
const DRAFT_KEY = 'roviq:draft:instituteGroup:new';
const DRAFT_SAVE_INTERVAL_MS = 30_000;

// ─── Schemas ─────────────────────────────────────────────────────────────────

const phoneSchema = z.object({
  countryCode: z.string().default('+91'),
  number: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits.'),
  isPrimary: z.boolean().default(false),
  isWhatsappEnabled: z.boolean().default(false),
  label: z.string().max(50).default(''),
});

const emailSchema = z.object({
  address: z.string().email('Invalid email address.'),
  isPrimary: z.boolean().default(false),
  label: z.string().max(50).default(''),
});

const contactSchema = z.object({
  phones: z.array(phoneSchema).default([]),
  emails: z.array(emailSchema).default([]),
});

function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    name: z.string().min(1, t('validation.nameRequired')).max(200, t('validation.nameMax')),
    code: z
      .string()
      .min(1, t('validation.codeRequired'))
      .max(50, t('validation.codeMax'))
      .regex(/^[a-z0-9-]+$/, t('validation.codeFormat')),
    type: z.enum(GROUP_TYPE_VALUES),
    registrationNumber: z
      .string()
      .max(100, t('validation.registrationNumberMax'))
      .optional()
      .default(''),
    registrationState: z.enum(INDIAN_STATE_VALUES).optional(),
    contact: contactSchema,
    // Address block is optional for institute groups — empty values are dropped
    // on submit (see `values.address.line1 ? values.address : undefined`).
    address: optionalAddressSchema,
  });
}

type CreateGroupFormValues = z.infer<ReturnType<typeof buildSchema>>;

const DEFAULT_VALUES: CreateGroupFormValues = {
  name: '',
  code: '',
  type: 'TRUST',
  registrationNumber: '',
  registrationState: undefined,
  contact: { phones: [], emails: [] },
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
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function NewInstituteGroupPage() {
  const t = useTranslations('instituteGroups');
  const tGeo = useTranslations('geography');
  const router = useRouter();
  const [createGroup, { loading }] = useCreateInstituteGroup();
  const [draftRestored, setDraftRestored] = useState(false);

  const schema = useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onChange: zodValidator(schema), onSubmit: zodValidator(schema) },
    onSubmit: async ({ value, formApi }) => {
      try {
        await createGroup({
          variables: {
            input: {
              name: value.name,
              code: value.code,
              type: value.type,
              registrationNumber: value.registrationNumber || undefined,
              registrationState: value.registrationState || undefined,
              contact:
                value.contact.phones.length > 0 || value.contact.emails.length > 0
                  ? value.contact
                  : undefined,
              address: value.address.line1 ? value.address : undefined,
            },
          },
        });
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          // Ignore
        }
        toast.success(t('created'));
        router.push('/admin/institute-groups');
      } catch (err) {
        const message = extractGraphQLError(err, t('createFailed'));
        if (message.includes('CODE_DUPLICATE') || message.includes('already exists')) {
          formApi.setFieldMeta('code', (prev) => ({
            ...prev,
            errorMap: { ...prev.errorMap, onSubmit: t('codeDuplicate') },
          }));
        } else {
          toast.error(t('createFailed'), { description: message });
        }
      }
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  // ─── Draft auto-save [HUPGP] ─────────────────────────────────────────────
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = schema.partial().safeParse(JSON.parse(saved));
        if (parsed.success) {
          form.reset({ ...DEFAULT_VALUES, ...parsed.data } as CreateGroupFormValues);
          setDraftRestored(true);
        }
      }
    } catch {
      // Corrupt draft — ignore and start fresh
    }
  }, [form, schema]);

  useEffect(() => {
    const saveDraft = () => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form.store.state.values));
      } catch {
        // Storage full or unavailable — silently skip
      }
    };
    const interval = window.setInterval(saveDraft, DRAFT_SAVE_INTERVAL_MS);
    const handleBlur = () => saveDraft();
    window.addEventListener('blur', handleBlur, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('blur', handleBlur, true);
    };
  }, [form]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore
    }
    form.reset(DEFAULT_VALUES);
    setDraftRestored(false);
  }, [form]);

  return (
    <div className="mx-auto max-w-2xl space-y-6" aria-busy={isSubmitting || loading}>
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm" aria-label={t('backAria')}>
          <Link href="/admin/institute-groups" className="flex items-center gap-1">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t('back')}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('createGroup')}</h1>
        <p className="text-muted-foreground">{t('createGroupSubtitle')}</p>
      </div>

      {draftRestored && (
        <output
          aria-live="polite"
          className="flex items-start justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950"
        >
          <div>
            <p className="font-medium">{t('draftRestoredTitle')}</p>
            <p className="text-muted-foreground">{t('draftRestoredBody')}</p>
          </div>
          <Button
            data-testid={adminInstituteGroups.clearDraftBtn}
            type="button"
            variant="outline"
            size="sm"
            onClick={clearDraft}
          >
            {t('clearDraft')}
          </Button>
        </output>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('createGroup')}</CardTitle>
          <CardDescription>{t('createGroupSubtitle')}</CardDescription>
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
            <FieldGroup>
              {/* ─── Basic Information ─────────────────────────────────── */}
              <FieldSet data-testid={adminInstituteGroups.formSectionBasic}>
                <FieldLegend>{t('sectionBasic')}</FieldLegend>

                <form.AppField name="name">
                  {(field) => (
                    <field.TextField
                      label={t('name')}
                      description={t('nameDescription')}
                      placeholder={t('namePlaceholder')}
                      maxLength={200}
                      testId="institute-group-name-input"
                      errorTestId="institute-group-name-error"
                    />
                  )}
                </form.AppField>

                <form.AppField name="code">
                  {(field) => (
                    <field.TextField
                      label={t('code')}
                      info={
                        <FieldInfoPopover
                          title={t('codeHelpTitle')}
                          data-testid={adminInstituteGroups.codeInfo}
                        >
                          <p>{t('codeHelpBody')}</p>
                        </FieldInfoPopover>
                      }
                      description={t('codeDescription')}
                      placeholder={t('codePlaceholder')}
                      maxLength={50}
                      autoComplete="off"
                      testId="institute-group-code-input"
                      errorTestId="institute-group-code-error"
                    />
                  )}
                </form.AppField>

                <form.AppField name="type">
                  {(field) => (
                    <field.SelectField
                      label={t('type')}
                      description={t('typeDescription')}
                      options={GROUP_TYPE_VALUES.map((type) => ({
                        value: type,
                        label: (
                          <div className="flex flex-col">
                            <span>{t(`types.${type}`)}</span>
                            <span className="text-xs text-muted-foreground">
                              {t(`typeDescriptions.${type}`)}
                            </span>
                          </div>
                        ),
                      }))}
                      optional={false}
                      testId="institute-group-type-select"
                      info={
                        <FieldInfoPopover
                          title={t('fieldHelp.typeTitle')}
                          data-testid={adminInstituteGroups.typeInfo}
                        >
                          <p>{t('fieldHelp.typeBody')}</p>
                          <ul className="mt-1 list-disc space-y-0.5 ps-4">
                            <li>{t('fieldHelp.typeTrust')}</li>
                            <li>{t('fieldHelp.typeSociety')}</li>
                            <li>{t('fieldHelp.typeChain')}</li>
                            <li>{t('fieldHelp.typeFranchise')}</li>
                          </ul>
                        </FieldInfoPopover>
                      }
                    />
                  )}
                </form.AppField>
              </FieldSet>

              {/* ─── Legal & Registration ──────────────────────────────── */}
              <FieldSet data-testid={adminInstituteGroups.formSectionRegistration}>
                <FieldLegend>{t('sectionRegistration')}</FieldLegend>

                <form.AppField name="registrationNumber">
                  {(field) => (
                    <field.TextField
                      label={t('registrationNumber')}
                      description={t('registrationNumberDescription')}
                      placeholder={t('registrationNumberPlaceholder')}
                      maxLength={100}
                      testId="institute-group-registration-number-input"
                      errorTestId="institute-group-registration-number-error"
                      info={
                        <FieldInfoPopover
                          title={t('fieldHelp.registrationNumberTitle')}
                          data-testid={adminInstituteGroups.registrationNumberInfo}
                        >
                          <p>{t('fieldHelp.registrationNumberBody')}</p>
                        </FieldInfoPopover>
                      }
                    />
                  )}
                </form.AppField>

                <form.AppField name="registrationState">
                  {(field) => (
                    <field.SelectField
                      label={t('registrationState')}
                      description={t('registrationStateDescription')}
                      placeholder={t('registrationStatePlaceholder')}
                      options={INDIAN_STATE_VALUES.map((state) => ({
                        value: state,
                        label: tGeo(`states.${state}`),
                      }))}
                      testId="institute-group-registration-state-select"
                      info={
                        <FieldInfoPopover
                          title={t('fieldHelp.registrationStateTitle')}
                          data-testid={adminInstituteGroups.registrationStateInfo}
                        >
                          <p>{t('fieldHelp.registrationStateBody')}</p>
                        </FieldInfoPopover>
                      }
                    />
                  )}
                </form.AppField>
              </FieldSet>

              {/* ─── Contact Details ───────────────────────────────────── */}
              <FieldSet data-testid={adminInstituteGroups.formSectionContact}>
                <FieldLegend>{t('contact')}</FieldLegend>
                <FieldDescription>{t('contactDescription')}</FieldDescription>
                <ContactBuilder form={form} />
              </FieldSet>

              {/* ─── Address ───────────────────────────────────────────── */}
              <FieldSet data-testid={adminInstituteGroups.formSectionAddress}>
                <FieldLegend>{t('address')}</FieldLegend>
                <FieldDescription>{t('addressDescription')}</FieldDescription>
                <AddressForm form={form} />
              </FieldSet>
            </FieldGroup>

            <div className="mt-6 flex justify-end gap-3">
              <Button asChild type="button" variant="outline">
                <Link href="/admin/institute-groups">{t('cancel')}</Link>
              </Button>
              <form.AppForm>
                <form.SubmitButton
                  testId="institute-group-create-submit-btn"
                  disabled={loading}
                  submittingLabel={t('creating')}
                >
                  {t('createGroup')}
                </form.SubmitButton>
              </form.AppForm>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { testIds } from '@roviq/ui/testing/testid-registry';
