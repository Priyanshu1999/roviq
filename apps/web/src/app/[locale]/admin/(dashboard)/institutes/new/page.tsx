'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { extractGraphQLError } from '@roviq/graphql';
import { i18nTextSchema, useFormatDate } from '@roviq/i18n';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  I18nInput,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@roviq/ui';
import { Check, ChevronsUpDown, HelpCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Controller, FormProvider, type Resolver, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCreateInstitute } from '../use-institutes';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Available institute types on the platform. */
const INSTITUTE_TYPES = ['SCHOOL', 'COACHING', 'LIBRARY'] as const;

/** Academic structure frameworks (school-only). */
const FRAMEWORKS = ['NEP', 'TRADITIONAL'] as const;

/** Education boards (school-only). */
const BOARDS = ['cbse', 'bseh', 'rbse', 'icse'] as const;

/** Academic departments (school-only). */
const DEPARTMENTS = [
  'pre_primary',
  'primary',
  'upper_primary',
  'secondary',
  'senior_secondary',
] as const;

/** Indian states and union territories for the address state dropdown. */
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

const DRAFT_STORAGE_KEY = 'roviq:draft:adminCreateInstitute:new';
const DRAFT_AUTO_SAVE_INTERVAL_MS = 30_000;

// ─── Schema factory (uses next-intl for error messages) ──────────────────────

function buildSchema(t: ReturnType<typeof useTranslations>) {
  const phoneSchema = z.object({
    country_code: z.string().default('+91'),
    number: z.string().regex(/^\d{10}$/, t('phoneInvalid')),
    is_primary: z.boolean().default(false),
    is_whatsapp_enabled: z.boolean().default(false),
    label: z.string().max(50).default(''),
  });

  const emailSchema = z.object({
    address: z.string().email(t('emailInvalid')),
    is_primary: z.boolean().default(false),
    label: z.string().max(50).default(''),
  });

  const contactSchema = z.object({
    phones: z.array(phoneSchema).default([]),
    emails: z.array(emailSchema).default([]),
  });

  const addressSchema = z.object({
    line1: z.string().min(1, t('line1Required')),
    line2: z.string().optional().default(''),
    line3: z.string().optional().default(''),
    city: z.string().min(1, t('cityRequired')),
    district: z.string().min(1, t('districtRequired')),
    state: z.string().min(1, t('stateRequired')),
    postal_code: z.string().regex(/^\d{6}$/, t('postalCodeInvalid')),
    country: z.string().default('IN'),
    // `AddressForm` registers lat/lng with `valueAsNumber: true`, which produces
    // `NaN` for empty inputs. Preprocess back to `undefined` so blank
    // coordinates pass validation instead of surfacing Zod's raw NaN message.
    coordinates: z
      .object({
        lat: z.preprocess(
          (v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v),
          z.number().min(-90).max(90).optional(),
        ),
        lng: z.preprocess(
          (v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v),
          z.number().min(-180).max(180).optional(),
        ),
      })
      .optional(),
  });

  return z.object({
    name: i18nTextSchema,
    code: z.string().min(1, t('codeRequired')).max(50, t('codeTooLong')),
    slug: z.string().optional(),
    type: z.enum(INSTITUTE_TYPES),
    structureFramework: z.enum(FRAMEWORKS).optional(),
    board: z.string().optional(),
    departments: z.array(z.string()).optional(),
    contact: contactSchema.optional(),
    address: addressSchema.optional(),
    reseller: z.string().optional(),
    group: z.string().optional(),
    isDemo: z.boolean().default(false),
  });
}

type CreateInstituteFormValues = z.infer<ReturnType<typeof buildSchema>>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Formats a 10-digit Indian mobile as "98765 43210". */
function formatIndianMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

interface PostalLookupResult {
  city: string;
  district: string;
  state: string;
}

/**
 * Looks up city/district/state from an Indian PIN code via the free
 * postalpincode.in API. Returns null on any failure (offline, rate-limited, etc).
 */
async function lookupIndianPin(
  pin: string,
  signal: AbortSignal,
): Promise<PostalLookupResult | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (!Array.isArray(body) || body.length === 0) return null;
    const first = body[0] as {
      Status?: string;
      PostOffice?: Array<{ Block?: string; Name?: string; District?: string; State?: string }>;
    };
    if (first.Status !== 'Success' || !first.PostOffice || first.PostOffice.length === 0) {
      return null;
    }
    const po = first.PostOffice[0];
    if (!po) return null;
    return {
      city: po.Block || po.Name || '',
      district: po.District || '',
      state: po.State || '',
    };
  } catch {
    return null;
  }
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CreateInstitutePage() {
  const t = useTranslations('adminInstitutes.create');
  const tTypes = useTranslations('adminInstitutes.types');
  const router = useRouter();
  const { formatDistance } = useFormatDate();
  const [createInstitute] = useCreateInstitute();

  const schema = useMemo(() => buildSchema(t), [t]);

  const defaultValues: CreateInstituteFormValues = useMemo(
    () => ({
      name: { en: '' },
      code: '',
      type: 'SCHOOL',
      structureFramework: 'TRADITIONAL',
      board: 'cbse',
      departments: [],
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
        emails: [{ address: '', is_primary: true, label: '' }],
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
      reseller: '',
      group: '',
      isDemo: false,
    }),
    [],
  );

  const form = useForm<CreateInstituteFormValues>({
    resolver: zodResolver(schema) as Resolver<CreateInstituteFormValues>,
    defaultValues,
    mode: 'onBlur',
  });

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    reset,
    setError,
    control,
    formState: { isSubmitting },
  } = form;

  const instituteType = watch('type');
  const isSchool = instituteType === 'SCHOOL';
  const selectedDepartments = watch('departments') ?? [];

  // ─── Draft restore banner ────────────────────────────────────────────────
  const [draftMeta, setDraftMeta] = useState<{ savedAt: number } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { savedAt: number; values: unknown };
      if (parsed && typeof parsed.savedAt === 'number') {
        setDraftMeta({ savedAt: parsed.savedAt });
      }
    } catch {
      // malformed draft — ignore
    }
  }, []);

  const restoreDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { values: CreateInstituteFormValues };
      if (parsed?.values) {
        reset(parsed.values);
      }
    } catch {
      // ignore
    }
    setDraftMeta(null);
  }, [reset]);

  const discardDraft = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
    setDraftMeta(null);
  }, []);

  // ─── Auto-save draft every 30s ───────────────────────────────────────────
  const saveDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload = JSON.stringify({ savedAt: Date.now(), values: getValues() });
      window.localStorage.setItem(DRAFT_STORAGE_KEY, payload);
    } catch {
      // quota exceeded or disabled — ignore
    }
  }, [getValues]);

  useEffect(() => {
    const id = window.setInterval(saveDraft, DRAFT_AUTO_SAVE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [saveDraft]);

  // Save on blur of any field in the form.
  const handleFieldBlur = useCallback(() => {
    saveDraft();
  }, [saveDraft]);

  // ─── Field arrays for contact ────────────────────────────────────────────

  const {
    fields: phoneFields,
    append: appendPhone,
    remove: removePhone,
  } = useFieldArray({ control, name: 'contact.phones' });

  const {
    fields: emailFields,
    append: appendEmail,
    remove: removeEmail,
  } = useFieldArray({ control, name: 'contact.emails' });

  const phones = watch('contact.phones') ?? [];

  function handlePhonePrimaryChange(index: number) {
    phones.forEach((_, i) => {
      setValue(`contact.phones.${i}.is_primary`, i === index, {
        shouldDirty: true,
      });
    });
  }

  function toggleDepartment(dept: string) {
    const current = selectedDepartments;
    const updated = current.includes(dept) ? current.filter((d) => d !== dept) : [...current, dept];
    setValue('departments', updated, { shouldDirty: true });
  }

  // ─── PIN code auto-lookup ────────────────────────────────────────────────
  const pinLookupAbortRef = useRef<AbortController | null>(null);

  const handlePinBlur = useCallback(
    async (pin: string) => {
      saveDraft();
      if (!/^\d{6}$/.test(pin)) return;
      pinLookupAbortRef.current?.abort();
      const ctrl = new AbortController();
      pinLookupAbortRef.current = ctrl;
      const result = await lookupIndianPin(pin, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!result) {
        toast.warning(t('postalCodeLookupFailed'));
        return;
      }
      // Only fill empty fields — never overwrite user input
      const current = getValues('address');
      if (!current?.city && result.city) {
        setValue('address.city', result.city, { shouldDirty: true, shouldValidate: true });
      }
      if (!current?.district && result.district) {
        setValue('address.district', result.district, { shouldDirty: true, shouldValidate: true });
      }
      if (
        !current?.state &&
        result.state &&
        INDIAN_STATES.includes(result.state as (typeof INDIAN_STATES)[number])
      ) {
        setValue('address.state', result.state, { shouldDirty: true, shouldValidate: true });
      }
      toast.success(t('postalCodeLookedUp', { pin }));
    },
    [getValues, saveDraft, setValue, t],
  );

  // ─── Address preview ─────────────────────────────────────────────────────
  const addressWatch = watch('address');
  const addressPreview = useMemo(() => {
    if (!addressWatch) return '';
    const parts = [
      addressWatch.line1,
      addressWatch.line2,
      addressWatch.line3,
      addressWatch.city,
      addressWatch.district,
      addressWatch.state,
      addressWatch.postal_code,
    ].filter((p): p is string => !!p && p.trim().length > 0);
    return parts.join(', ');
  }, [addressWatch]);

  // ─── Submit ──────────────────────────────────────────────────────────────

  const onSubmit = async (values: CreateInstituteFormValues) => {
    const slug = values.code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Normalize phone numbers to E.164 on submit (display keeps the formatted version).
    const contact = values.contact
      ? {
          ...values.contact,
          phones: values.contact.phones.map((p) => ({
            ...p,
            number: p.number.replace(/\D/g, ''),
          })),
        }
      : undefined;

    try {
      const result = await createInstitute({
        variables: {
          input: {
            name: values.name,
            code: values.code,
            slug,
            type: values.type,
            structureFramework: isSchool ? values.structureFramework : undefined,
            board: isSchool ? values.board : undefined,
            departments: isSchool ? values.departments : undefined,
            contact,
            address: values.address,
            isDemo: values.isDemo,
          },
        },
      });
      toast.success(t('success'));
      discardDraft();
      const id = result.data?.createInstitute.id;
      if (id) router.push(`/admin/institutes/${id}`);
    } catch (err) {
      const message = extractGraphQLError(err, t('error'));
      if (message.includes('INSTITUTE_CODE_DUPLICATE') || message.includes('already exists')) {
        setError('code', { message: t('codeDuplicate') });
      } else if (message.includes('RESELLER_INVALID')) {
        toast.error(t('resellerInvalid'));
      } else {
        toast.error(t('error'), { description: message });
      }
    }
  };

  const onInvalid = () => {
    toast.error(t('formInvalid'));
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {draftMeta && (
        <Card role="status" aria-live="polite">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">
              {t('draftBanner', { time: formatDistance(draftMeta.savedAt, Date.now()) })}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={discardDraft}>
                {t('draftDiscard')}
              </Button>
              <Button type="button" size="sm" onClick={restoreDraft}>
                {t('draftRestore')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormProvider {...form}>
            <form
              onSubmit={handleSubmit(onSubmit, onInvalid)}
              onBlur={handleFieldBlur}
              aria-busy={isSubmitting}
              noValidate
            >
              <FieldGroup>
                {/* ─── Section: Basic Information ───────────────────────── */}

                <FieldSet>
                  <FieldLegend>{t('sections.identity')}</FieldLegend>
                  <FieldDescription>{t('sections.identityDescription')}</FieldDescription>

                  <I18nInput<CreateInstituteFormValues>
                    name="name"
                    label={t('name')}
                    required
                    placeholder={t('namePlaceholder')}
                  />

                  <Controller
                    control={control}
                    name="code"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="code" className="flex items-center gap-1.5">
                          {t('code')}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={t('codeHelpTitle')}
                                title={t('codeHelpTitle')}
                              >
                                <HelpCircle className="size-3.5 text-muted-foreground" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="max-w-xs text-sm">
                              <p className="mb-1 font-medium">{t('codeHelpTitle')}</p>
                              <p className="text-muted-foreground">{t('codeHelpBody')}</p>
                            </PopoverContent>
                          </Popover>
                        </FieldLabel>
                        <FieldDescription>{t('codeDescription')}</FieldDescription>
                        <Input
                          {...field}
                          id="code"
                          placeholder={t('codePlaceholder')}
                          maxLength={50}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <Controller
                    control={control}
                    name="type"
                    render={({ field }) => (
                      <Field>
                        <FieldLabel htmlFor="type-trigger">{t('type')}</FieldLabel>
                        <FieldDescription>{t('typeDescription')}</FieldDescription>
                        <Select
                          value={field.value}
                          onValueChange={(v) =>
                            field.onChange(v as CreateInstituteFormValues['type'])
                          }
                        >
                          <SelectTrigger id="type-trigger">
                            <SelectValue placeholder={t('typePlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {INSTITUTE_TYPES.map((tp) => (
                              <SelectItem key={tp} value={tp}>
                                {tTypes(tp)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                </FieldSet>

                {/* ─── Section: Board & Departments (school only) ──────── */}

                {isSchool && (
                  <FieldSet>
                    <FieldLegend>{t('sections.schoolSpecific')}</FieldLegend>
                    <FieldDescription>{t('sections.schoolSpecificDescription')}</FieldDescription>

                    <Controller
                      control={control}
                      name="structureFramework"
                      render={({ field }) => (
                        <Field>
                          <FieldLabel
                            htmlFor="framework-trigger"
                            className="flex items-center gap-1.5"
                          >
                            {t('structureFramework')}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t('structureFrameworkHelpTitle')}
                                  title={t('structureFrameworkHelpTitle')}
                                >
                                  <HelpCircle className="size-3.5 text-muted-foreground" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="max-w-xs text-sm">
                                <p className="mb-1 font-medium">
                                  {t('structureFrameworkHelpTitle')}
                                </p>
                                <p className="text-muted-foreground">
                                  {t('structureFrameworkHelpBody')}
                                </p>
                              </PopoverContent>
                            </Popover>
                          </FieldLabel>
                          <FieldDescription>{t('structureFrameworkDescription')}</FieldDescription>
                          <Select
                            value={field.value ?? 'TRADITIONAL'}
                            onValueChange={(v) => field.onChange(v as 'NEP' | 'TRADITIONAL')}
                          >
                            <SelectTrigger id="framework-trigger">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FRAMEWORKS.map((fw) => (
                                <SelectItem key={fw} value={fw}>
                                  {t(`frameworks.${fw}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />

                    <Controller
                      control={control}
                      name="board"
                      render={({ field }) => {
                        const selected = BOARDS.find((b) => b === field.value);
                        return (
                          <Field>
                            <FieldLabel>{t('board')}</FieldLabel>
                            <FieldDescription>{t('boardDescription')}</FieldDescription>
                            <BoardCombobox
                              value={field.value ?? ''}
                              onChange={field.onChange}
                              selectedLabel={selected ? t(`boards.${selected}`) : undefined}
                              t={t}
                            />
                          </Field>
                        );
                      }}
                    />

                    <Field>
                      <FieldLabel>{t('departments')}</FieldLabel>
                      <FieldDescription>{t('departmentsDescription')}</FieldDescription>
                      <div className="flex flex-wrap gap-3">
                        {DEPARTMENTS.map((dept) => (
                          <FieldLabel
                            key={dept}
                            htmlFor={`dept-${dept}`}
                            className="flex cursor-pointer items-center gap-2 font-normal"
                          >
                            <Checkbox
                              id={`dept-${dept}`}
                              checked={selectedDepartments.includes(dept)}
                              onCheckedChange={() => toggleDepartment(dept)}
                            />
                            {t(`departmentOptions.${dept}`)}
                          </FieldLabel>
                        ))}
                      </div>
                    </Field>
                  </FieldSet>
                )}

                {/* ─── Section: Ownership ──────────────────────────────── */}

                <FieldSet>
                  <FieldLegend>{t('sections.ownership')}</FieldLegend>
                  <FieldDescription>{t('sections.ownershipDescription')}</FieldDescription>

                  <Field>
                    <FieldLabel htmlFor="reseller">{t('reseller')}</FieldLabel>
                    <FieldDescription>{t('resellerDescription')}</FieldDescription>
                    <Input id="reseller" {...register('reseller')} placeholder={t('roviqDirect')} />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="group">{t('group')}</FieldLabel>
                    <FieldDescription>{t('groupDescription')}</FieldDescription>
                    <Input id="group" {...register('group')} placeholder={t('groupPlaceholder')} />
                  </Field>
                </FieldSet>

                {/* ─── Section: Contact ────────────────────────────────── */}

                <FieldSet>
                  <FieldLegend>{t('sections.contact')}</FieldLegend>
                  <FieldDescription>{t('sections.contactDescription')}</FieldDescription>

                  <Field>
                    <FieldLabel>{t('phones')}</FieldLabel>
                    <FieldDescription>{t('phonesDescription')}</FieldDescription>
                  </Field>

                  <div className="space-y-3">
                    {phoneFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-[88px_1fr_auto_auto_1fr_auto] items-end gap-2 rounded-lg border p-3"
                      >
                        <Field>
                          <FieldLabel className="text-xs">{t('countryCode')}</FieldLabel>
                          <Input
                            {...register(`contact.phones.${index}.country_code`)}
                            className="text-center"
                            readOnly
                            aria-readonly="true"
                          />
                        </Field>

                        <Controller
                          control={control}
                          name={`contact.phones.${index}.number`}
                          render={({ field: numberField, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={`phone-${index}`} className="text-xs">
                                {t('phoneNumber')}
                              </FieldLabel>
                              <Input
                                id={`phone-${index}`}
                                inputMode="numeric"
                                maxLength={12}
                                placeholder={t('phonePlaceholder')}
                                aria-invalid={fieldState.invalid}
                                aria-describedby={`phone-${index}-constraint`}
                                value={numberField.value ?? ''}
                                onChange={(e) =>
                                  numberField.onChange(
                                    e.target.value.replace(/\D/g, '').slice(0, 10),
                                  )
                                }
                                onBlur={() => {
                                  numberField.onChange(formatIndianMobile(numberField.value ?? ''));
                                  numberField.onBlur();
                                }}
                              />
                              <FieldDescription id={`phone-${index}-constraint`}>
                                {t('phoneConstraint')}
                              </FieldDescription>
                              {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                          )}
                        />

                        <Field>
                          <FieldLabel className="text-xs">{t('isPrimary')}</FieldLabel>
                          <div className="flex h-8 items-center">
                            <Checkbox
                              checked={phones[index]?.is_primary ?? false}
                              onCheckedChange={() => handlePhonePrimaryChange(index)}
                              aria-label={t('isPrimary')}
                            />
                          </div>
                        </Field>

                        <Field>
                          <FieldLabel className="text-xs">{t('isWhatsappEnabled')}</FieldLabel>
                          <div className="flex h-8 items-center">
                            <Switch
                              checked={phones[index]?.is_whatsapp_enabled ?? false}
                              onCheckedChange={(v) =>
                                setValue(`contact.phones.${index}.is_whatsapp_enabled`, v, {
                                  shouldDirty: true,
                                })
                              }
                              aria-label={t('isWhatsappEnabled')}
                            />
                          </div>
                          <FieldDescription>{t('whatsappHelp')}</FieldDescription>
                        </Field>

                        <Field>
                          <FieldLabel className="text-xs">{t('phoneLabel')}</FieldLabel>
                          <Input
                            {...register(`contact.phones.${index}.label`)}
                            placeholder={t('phoneLabelPlaceholder')}
                          />
                        </Field>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removePhone(index)}
                          aria-label={t('removePhone')}
                          title={t('removePhone')}
                          disabled={phoneFields.length <= 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      appendPhone({
                        country_code: '+91',
                        number: '',
                        is_primary: phoneFields.length === 0,
                        is_whatsapp_enabled: phoneFields.length === 0,
                        label: '',
                      })
                    }
                  >
                    <Plus className="size-4" />
                    {t('addPhone')}
                  </Button>

                  <FieldSeparator />

                  <Field>
                    <FieldLabel>{t('emails')}</FieldLabel>
                    <FieldDescription>{t('emailsDescription')}</FieldDescription>
                  </Field>

                  <div className="space-y-3">
                    {emailFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2 rounded-lg border p-3"
                      >
                        <Controller
                          control={control}
                          name={`contact.emails.${index}.address`}
                          render={({ field: emailField, fieldState }) => (
                            <Field data-invalid={fieldState.invalid}>
                              <FieldLabel htmlFor={`email-${index}`} className="text-xs">
                                {t('emailAddress')}
                              </FieldLabel>
                              <Input
                                id={`email-${index}`}
                                type="email"
                                placeholder={t('emailPlaceholder')}
                                aria-invalid={fieldState.invalid}
                                {...emailField}
                              />
                              {fieldState.error && <FieldError errors={[fieldState.error]} />}
                            </Field>
                          )}
                        />

                        <Field>
                          <FieldLabel className="text-xs">{t('emailIsPrimary')}</FieldLabel>
                          <div className="flex h-8 items-center">
                            <Checkbox
                              checked={watch(`contact.emails.${index}.is_primary`)}
                              onCheckedChange={(v) =>
                                setValue(`contact.emails.${index}.is_primary`, !!v, {
                                  shouldDirty: true,
                                })
                              }
                              aria-label={t('emailIsPrimary')}
                            />
                          </div>
                        </Field>

                        <Field>
                          <FieldLabel className="text-xs">{t('emailLabel')}</FieldLabel>
                          <Input
                            {...register(`contact.emails.${index}.label`)}
                            placeholder={t('emailLabelPlaceholder')}
                          />
                        </Field>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeEmail(index)}
                          aria-label={t('removeEmail')}
                          title={t('removeEmail')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendEmail({ address: '', is_primary: false, label: '' })}
                  >
                    <Plus className="size-4" />
                    {t('addEmail')}
                  </Button>
                </FieldSet>

                {/* ─── Section: Address ────────────────────────────────── */}

                <FieldSet>
                  <FieldLegend>{t('sections.address')}</FieldLegend>
                  <FieldDescription>{t('sections.addressDescription')}</FieldDescription>

                  <Controller
                    control={control}
                    name="address.line1"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="address-line1">{t('line1')}</FieldLabel>
                        <Input
                          {...field}
                          id="address-line1"
                          placeholder={t('line1Placeholder')}
                          aria-invalid={fieldState.invalid}
                        />
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <Field>
                    <FieldLabel htmlFor="address-line2">{t('line2')}</FieldLabel>
                    <Input
                      id="address-line2"
                      {...register('address.line2')}
                      placeholder={t('line2Placeholder')}
                    />
                  </Field>

                  <Controller
                    control={control}
                    name="address.postal_code"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor="address-postal-code">{t('postalCode')}</FieldLabel>
                        <FieldDescription>{t('postalCodeDescription')}</FieldDescription>
                        <Input
                          id="address-postal-code"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder={t('postalCodePlaceholder')}
                          aria-invalid={fieldState.invalid}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          onBlur={() => {
                            field.onBlur();
                            void handlePinBlur(field.value ?? '');
                          }}
                        />
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Controller
                      control={control}
                      name="address.city"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="address-city">{t('city')}</FieldLabel>
                          <Input
                            {...field}
                            id="address-city"
                            placeholder={t('cityPlaceholder')}
                            aria-invalid={fieldState.invalid}
                          />
                          {fieldState.error && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />

                    <Controller
                      control={control}
                      name="address.district"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="address-district">{t('district')}</FieldLabel>
                          <Input
                            {...field}
                            id="address-district"
                            placeholder={t('districtPlaceholder')}
                            aria-invalid={fieldState.invalid}
                          />
                          {fieldState.error && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  </div>

                  <Controller
                    control={control}
                    name="address.state"
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel>{t('state')}</FieldLabel>
                        <StateCombobox value={field.value ?? ''} onChange={field.onChange} t={t} />
                        {fieldState.error && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />

                  {addressPreview && (
                    <Field>
                      <FieldLabel>{t('addressPreview')}</FieldLabel>
                      <p
                        className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground"
                        aria-live="polite"
                      >
                        {addressPreview}
                      </p>
                    </Field>
                  )}
                </FieldSet>

                {/* ─── Section: Advanced ───────────────────────────────── */}

                <FieldSet>
                  <FieldLegend>{t('sections.advanced')}</FieldLegend>

                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldLabel htmlFor="isDemo">{t('isDemo')}</FieldLabel>
                      <FieldDescription>{t('isDemoDescription')}</FieldDescription>
                    </FieldContent>
                    <Switch
                      id="isDemo"
                      checked={watch('isDemo')}
                      onCheckedChange={(v) => setValue('isDemo', v, { shouldDirty: true })}
                      aria-label={t('isDemo')}
                    />
                  </Field>
                </FieldSet>
              </FieldGroup>

              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      {t('creating')}
                    </>
                  ) : (
                    t('submit')
                  )}
                </Button>
              </div>
            </form>
          </FormProvider>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Combobox subcomponents (cmdk-based, @roviq/ui primitives) ───────────────

interface StateComboboxProps {
  value: string;
  onChange: (value: string) => void;
  t: ReturnType<typeof useTranslations>;
}

function StateCombobox({ value, onChange, t }: StateComboboxProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={value ? '' : 'text-muted-foreground'}>
            {value || t('statePlaceholder')}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={t('stateSearchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('stateNoResults')}</CommandEmpty>
            <CommandGroup>
              {INDIAN_STATES.map((state) => (
                <CommandItem
                  key={state}
                  value={state}
                  onSelect={() => {
                    onChange(state);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 size-4 ${value === state ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {state}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface BoardComboboxProps {
  value: string;
  onChange: (value: string) => void;
  selectedLabel?: string;
  t: ReturnType<typeof useTranslations>;
}

function BoardCombobox({ value, onChange, selectedLabel, t }: BoardComboboxProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={value ? '' : 'text-muted-foreground'}>
            {selectedLabel || t('boardPlaceholder')}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={t('boardSearchPlaceholder')} />
          <CommandList>
            <CommandEmpty>{t('boardNoResults')}</CommandEmpty>
            <CommandGroup>
              {BOARDS.map((board) => (
                <CommandItem
                  key={board}
                  value={board}
                  onSelect={() => {
                    onChange(board);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 size-4 ${value === board ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {t(`boards.${board}`)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
