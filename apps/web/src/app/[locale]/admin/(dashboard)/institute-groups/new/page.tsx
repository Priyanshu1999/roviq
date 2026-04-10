'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { GROUP_TYPE_VALUES, optionalAddressSchema } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import {
  Button,
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
  FieldLegend,
  FieldSet,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { ArrowLeft, HelpCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, FormProvider, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { AddressForm } from '../../../../institute/(dashboard)/settings/institute/components/address-form';
import { ContactBuilder } from '../../../../institute/(dashboard)/settings/institute/components/contact-builder';
import { useCreateInstituteGroup } from '../use-institute-groups';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Indian states and union territories for the registration state dropdown. */
const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
] as const;

/** localStorage key for draft auto-save (see [HUPGP]). */
const DRAFT_KEY = 'roviq:draft:instituteGroup:new';
const DRAFT_SAVE_INTERVAL_MS = 30_000;

// ─── Schemas ─────────────────────────────────────────────────────────────────

const phoneSchema = z.object({
  country_code: z.string().default('+91'),
  number: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits.'),
  is_primary: z.boolean().default(false),
  is_whatsapp_enabled: z.boolean().default(false),
  label: z.string().max(50).default(''),
});

const emailSchema = z.object({
  address: z.string().email('Invalid email address.'),
  is_primary: z.boolean().default(false),
  label: z.string().max(50).default(''),
});

const contactSchema = z.object({
  phones: z.array(phoneSchema).default([]),
  emails: z.array(emailSchema).default([]),
});

const createGroupSchema = z.object({
  name: z.string().min(1, 'nameRequired').max(200, 'nameMax'),
  code: z
    .string()
    .min(1, 'codeRequired')
    .max(50, 'codeMax')
    .regex(/^[a-z0-9-]+$/, 'codeFormat'),
  type: z.enum(GROUP_TYPE_VALUES),
  registrationNumber: z.string().max(100, 'registrationNumberMax').optional().default(''),
  registrationState: z.string().optional().default(''),
  contact: contactSchema,
  // Address block is optional for institute groups — empty values are dropped
  // on submit (see `values.address.line1 ? values.address : undefined`).
  address: optionalAddressSchema,
});

type CreateGroupFormValues = z.infer<typeof createGroupSchema>;

const DEFAULT_VALUES: CreateGroupFormValues = {
  name: '',
  code: '',
  type: 'TRUST',
  registrationNumber: '',
  registrationState: '',
  contact: { phones: [], emails: [] },
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
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function NewInstituteGroupPage() {
  const t = useTranslations('instituteGroups');
  const router = useRouter();
  const [createGroup, { loading }] = useCreateInstituteGroup();
  const [draftRestored, setDraftRestored] = useState(false);

  const form = useForm<CreateGroupFormValues>({
    resolver: zodResolver(createGroupSchema) as Resolver<CreateGroupFormValues>,
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  // ─── Draft auto-save [HUPGP] ─────────────────────────────────────────────
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = createGroupSchema.partial().safeParse(JSON.parse(saved));
        if (parsed.success) {
          reset({ ...DEFAULT_VALUES, ...parsed.data } as CreateGroupFormValues);
          setDraftRestored(true);
        }
      }
    } catch {
      // Corrupt draft — ignore and start fresh
    }
  }, [reset]);

  useEffect(() => {
    const saveDraft = () => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(getValues()));
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
  }, [getValues]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore
    }
    reset(DEFAULT_VALUES);
    setDraftRestored(false);
  }, [reset]);

  // ─── Submit [NGIAC] ──────────────────────────────────────────────────────

  const onSubmit = async (values: CreateGroupFormValues) => {
    try {
      await createGroup({
        variables: {
          input: {
            name: values.name,
            code: values.code,
            type: values.type,
            registrationNumber: values.registrationNumber || undefined,
            registrationState: values.registrationState || undefined,
            contact:
              values.contact.phones.length > 0 || values.contact.emails.length > 0
                ? values.contact
                : undefined,
            address: values.address.line1 ? values.address : undefined,
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
        setError('code', { message: t('codeDuplicate') });
      } else {
        toast.error(t('createFailed'), { description: message });
      }
    }
  };

  // Map zod error codes back to translated messages.
  const translateValidation = useCallback(
    (key: string | undefined): string | undefined => {
      if (!key) return undefined;
      const allowed = [
        'nameRequired',
        'nameMax',
        'codeRequired',
        'codeFormat',
        'codeMax',
        'registrationNumberMax',
      ] as const;
      type ValidationKey = (typeof allowed)[number];
      const isKnown = (k: string): k is ValidationKey => (allowed as readonly string[]).includes(k);
      return isKnown(key) ? t(`validation.${key}`) : key;
    },
    [t],
  );

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
          <Button type="button" variant="outline" size="sm" onClick={clearDraft}>
            {t('clearDraft')}
          </Button>
        </output>
      )}

      <FormProvider {...form}>
        <Card>
          <CardHeader>
            <CardTitle>{t('createGroup')}</CardTitle>
            <CardDescription>{t('createGroupSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <FieldGroup>
                {/* ─── Basic Information ─────────────────────────────────── */}
                <FieldSet>
                  <FieldLegend>{t('sectionBasic')}</FieldLegend>

                  <Field data-invalid={!!errors.name}>
                    <FieldLabel htmlFor="group-name">{t('name')}</FieldLabel>
                    <FieldDescription>{t('nameDescription')}</FieldDescription>
                    <Input
                      id="group-name"
                      {...register('name')}
                      placeholder={t('namePlaceholder')}
                      maxLength={200}
                      aria-invalid={!!errors.name}
                    />
                    {errors.name && (
                      <FieldError>{translateValidation(errors.name.message)}</FieldError>
                    )}
                  </Field>

                  <Field data-invalid={!!errors.code}>
                    <div className="flex items-center gap-1">
                      <FieldLabel htmlFor="group-code">{t('code')}</FieldLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t('codeHelpTitle')}
                          >
                            <HelpCircle className="size-4" aria-hidden="true" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 text-sm" side="top">
                          <p className="font-medium">{t('codeHelpTitle')}</p>
                          <p className="mt-1 text-muted-foreground">{t('codeHelpBody')}</p>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <FieldDescription>{t('codeDescription')}</FieldDescription>
                    <Input
                      id="group-code"
                      {...register('code')}
                      placeholder={t('codePlaceholder')}
                      maxLength={50}
                      autoComplete="off"
                      aria-invalid={!!errors.code}
                    />
                    {errors.code && (
                      <FieldError>{translateValidation(errors.code.message)}</FieldError>
                    )}
                  </Field>

                  <Controller
                    control={control}
                    name="type"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="group-type">{t('type')}</FieldLabel>
                        <FieldDescription>{t('typeDescription')}</FieldDescription>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger id="group-type" aria-invalid={fieldState.invalid}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GROUP_TYPE_VALUES.map((type) => (
                              <SelectItem key={type} value={type}>
                                <div className="flex flex-col">
                                  <span>{t(`types.${type}`)}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {t(`typeDescriptions.${type}`)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                </FieldSet>

                {/* ─── Legal & Registration ──────────────────────────────── */}
                <FieldSet>
                  <FieldLegend>{t('sectionRegistration')}</FieldLegend>

                  <Field data-invalid={!!errors.registrationNumber}>
                    <FieldLabel htmlFor="registration-number">{t('registrationNumber')}</FieldLabel>
                    <FieldDescription>{t('registrationNumberDescription')}</FieldDescription>
                    <Input
                      id="registration-number"
                      {...register('registrationNumber')}
                      placeholder={t('registrationNumberPlaceholder')}
                      maxLength={100}
                      aria-invalid={!!errors.registrationNumber}
                    />
                    {errors.registrationNumber && (
                      <FieldError>
                        {translateValidation(errors.registrationNumber.message)}
                      </FieldError>
                    )}
                  </Field>

                  <Controller
                    control={control}
                    name="registrationState"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor="registration-state">
                          {t('registrationState')}
                        </FieldLabel>
                        <FieldDescription>{t('registrationStateDescription')}</FieldDescription>
                        <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v)}>
                          <SelectTrigger id="registration-state">
                            <SelectValue placeholder={t('registrationStatePlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {INDIAN_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                </FieldSet>

                {/* ─── Contact Details ───────────────────────────────────── */}
                <FieldSet>
                  <FieldLegend>{t('contact')}</FieldLegend>
                  <FieldDescription>{t('contactDescription')}</FieldDescription>
                  <ContactBuilder />
                </FieldSet>

                {/* ─── Address ───────────────────────────────────────────── */}
                <FieldSet>
                  <FieldLegend>{t('address')}</FieldLegend>
                  <FieldDescription>{t('addressDescription')}</FieldDescription>
                  <AddressForm />
                </FieldSet>
              </FieldGroup>

              <div className="mt-6 flex justify-end gap-3">
                <Button asChild type="button" variant="outline">
                  <Link href="/admin/institute-groups">{t('cancel')}</Link>
                </Button>
                <Button type="submit" disabled={isSubmitting || loading}>
                  {(isSubmitting || loading) && (
                    <Loader2 className="me-2 size-4 animate-spin" aria-hidden="true" />
                  )}
                  {isSubmitting || loading ? t('creating') : t('createGroup')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </FormProvider>
    </div>
  );
}
