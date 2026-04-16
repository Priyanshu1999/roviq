'use client';

import { createAddressSchema, INDIAN_STATE_VALUES } from '@roviq/common-types';
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
  fieldErrorMessages,
  I18nField,
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
  useAppForm,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { Check, ChevronsUpDown, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useFormDraft } from '../../../../../../hooks/use-form-draft';
import { InstituteGroupCombobox } from '../_components/institute-group-combobox';
import { ResellerCombobox } from '../_components/reseller-combobox';
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

// ─── Schema factory (uses next-intl for error messages) ──────────────────────

function buildSchema(t: ReturnType<typeof useTranslations>) {
  const phoneSchema = z.object({
    countryCode: z.string().default('+91'),
    number: z.string().regex(/^\d{10}$/, t('phoneInvalid')),
    isPrimary: z.boolean().default(false),
    isWhatsappEnabled: z.boolean().default(false),
    label: z.string().max(50).default(''),
  });

  const emailSchema = z.object({
    address: z.string().email(t('emailInvalid')),
    isPrimary: z.boolean().default(false),
    label: z.string().max(50).default(''),
  });

  const contactSchema = z.object({
    phones: z.array(phoneSchema).default([]),
    emails: z.array(emailSchema).default([]),
  });

  const addressSchema = createAddressSchema({
    line1Required: t('line1Required'),
    cityRequired: t('cityRequired'),
    districtRequired: t('districtRequired'),
    stateRequired: t('stateRequired'),
    postalCodeInvalid: t('postalCodeInvalid'),
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
    resellerId: z.string().uuid().optional().nullable(),
    groupId: z.string().uuid().optional().nullable(),
    isDemo: z.boolean().default(false),
  });
}

type CreateInstituteSchema = ReturnType<typeof buildSchema>;
type CreateInstituteFormValues = z.input<CreateInstituteSchema>;

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

const DEFAULT_VALUES: CreateInstituteFormValues = {
  name: { en: '' },
  code: '',
  type: 'SCHOOL',
  structureFramework: 'TRADITIONAL',
  board: 'cbse',
  departments: [],
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
    emails: [{ address: '', isPrimary: true, label: '' }],
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
  resellerId: null,
  groupId: null,
  isDemo: false,
};

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CreateInstitutePage() {
  const t = useTranslations('adminInstitutes.create');
  const tTypes = useTranslations('adminInstitutes.types');
  const tGeo = useTranslations('geography');
  const router = useRouter();
  const { formatDistance } = useFormatDate();
  const [createInstitute] = useCreateInstitute();

  const schema = useMemo(() => buildSchema(t), [t]);

  const pinLookupAbortRef = useRef<AbortController | null>(null);

  const form = useAppForm({
    defaultValues: DEFAULT_VALUES,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);

      const slug = parsed.code
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const isSchoolType = parsed.type === 'SCHOOL';

      // Normalize phone numbers to E.164 on submit (display keeps the formatted version).
      const contact = parsed.contact
        ? {
            ...parsed.contact,
            phones: parsed.contact.phones.map((p) => ({
              ...p,
              number: p.number.replace(/\D/g, ''),
            })),
          }
        : undefined;

      try {
        const result = await createInstitute({
          variables: {
            input: {
              name: parsed.name,
              code: parsed.code,
              slug,
              type: parsed.type,
              structureFramework: isSchoolType ? parsed.structureFramework : undefined,
              board: isSchoolType ? parsed.board : undefined,
              departments: isSchoolType ? parsed.departments : undefined,
              contact,
              address: parsed.address,
              resellerId: parsed.resellerId ?? undefined,
              groupId: parsed.groupId ?? undefined,
              isDemo: parsed.isDemo,
            },
          },
        });
        toast.success(t('success'));
        clearDraft();
        const id = result.data?.adminCreateInstitute.id;
        if (id) router.push(`/admin/institutes/${id}`);
      } catch (err) {
        const message = extractGraphQLError(err, t('error'));
        if (message.includes('INSTITUTE_CODE_DUPLICATE') || message.includes('already exists')) {
          form.setFieldMeta('code', (prev) => ({
            ...prev,
            isTouched: true,
            errorMap: { ...prev.errorMap, onChange: t('codeDuplicate') },
          }));
          toast.error(t('codeDuplicate'));
        } else if (message.includes('RESELLER_INVALID')) {
          form.setFieldMeta('resellerId', (prev) => ({
            ...prev,
            isTouched: true,
            errorMap: { ...prev.errorMap, onChange: t('resellerInvalid') },
          }));
          toast.error(t('resellerInvalid'));
        } else {
          toast.error(t('error'), { description: message });
        }
      }
    },
  });

  const { hasDraft, restoreDraft, discardDraft, clearDraft, storedDraft } =
    useFormDraft<CreateInstituteFormValues>({
      key: 'adminCreateInstitute:new',
      form,
    });

  // Subscribe to live values for cascading sections + address preview.
  const instituteType = useStore(form.store, (s) => (s.values as CreateInstituteFormValues).type);
  const isSchool = instituteType === 'SCHOOL';
  const selectedDepartments = useStore(
    form.store,
    (s) => (s.values as CreateInstituteFormValues).departments ?? [],
  );
  const addressWatch = useStore(form.store, (s) => (s.values as CreateInstituteFormValues).address);

  const addressPreview = useMemo(() => {
    if (!addressWatch) return '';
    const parts = [
      addressWatch.line1,
      addressWatch.line2,
      addressWatch.line3,
      addressWatch.city,
      addressWatch.district,
      addressWatch.state,
      addressWatch.postalCode,
    ].filter((p): p is string => !!p && p.trim().length > 0);
    return parts.join(', ');
  }, [addressWatch]);

  function toggleDepartment(dept: string) {
    const current = selectedDepartments;
    const updated = current.includes(dept) ? current.filter((d) => d !== dept) : [...current, dept];
    form.setFieldValue('departments', updated);
  }

  // PIN auto-lookup — only fills empty address fields, never overwrites user input.
  const handlePinLookup = useCallback(
    async (pin: string) => {
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
      const current = (form.state.values as CreateInstituteFormValues).address;
      if (!current?.city && result.city) {
        form.setFieldValue('address.city', result.city);
      }
      if (!current?.district && result.district) {
        form.setFieldValue('address.district', result.district);
      }
      if (!current?.state && result.state) {
        const snakeKey = result.state
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/&/g, 'AND')
          .replace(/_AND_/g, '_AND_');
        if (INDIAN_STATE_VALUES.includes(snakeKey as (typeof INDIAN_STATE_VALUES)[number])) {
          form.setFieldValue('address.state', snakeKey);
        }
      }
      toast.success(t('postalCodeLookedUp', { pin }));
    },
    [form, t],
  );

  const draftSavedAt = storedDraft ? Date.now() : null;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="admin-institute-new-title">
          {t('title')}
        </h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {hasDraft && draftSavedAt !== null && (
        <Card role="status" aria-live="polite">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm">
              {t('draftBanner', { time: formatDistance(draftSavedAt, Date.now()) })}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={discardDraft}
                data-testid="admin-institute-new-draft-discard-btn"
              >
                {t('draftDiscard')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={restoreDraft}
                data-testid="admin-institute-new-draft-restore-btn"
              >
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
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              {/* ─── Section: Basic Information ───────────────────────── */}

              <FieldSet data-testid="institute-form-section-basic">
                <FieldLegend>{t('sections.identity')}</FieldLegend>
                <FieldDescription>{t('sections.identityDescription')}</FieldDescription>

                <I18nField
                  form={form}
                  name="name"
                  label={t('name')}
                  placeholder={t('namePlaceholder')}
                  testId="admin-institute-new-name"
                />

                <form.AppField name="code">
                  {(field) => {
                    const errors = fieldErrorMessages(field);
                    const invalid = errors.length > 0;
                    const value = typeof field.state.value === 'string' ? field.state.value : '';
                    return (
                      <Field data-invalid={invalid || undefined}>
                        <FieldLabel htmlFor={field.name} className="flex items-center gap-1.5">
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
                          id={field.name}
                          name={field.name}
                          value={value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          data-testid="admin-institute-new-code-input"
                          placeholder={t('codePlaceholder')}
                          maxLength={50}
                          aria-invalid={invalid || undefined}
                        />
                        {invalid && <FieldError errors={errors} />}
                      </Field>
                    );
                  }}
                </form.AppField>

                <form.AppField name="type">
                  {(field) => (
                    <field.SelectField
                      label={t('type')}
                      description={t('typeDescription')}
                      placeholder={t('typePlaceholder')}
                      options={INSTITUTE_TYPES.map((tp) => ({ value: tp, label: tTypes(tp) }))}
                      optional={false}
                      testId="admin-institute-new-type-select"
                    />
                  )}
                </form.AppField>
              </FieldSet>

              {/* ─── Section: Board & Departments (school only) ──────── */}

              {isSchool && (
                <FieldSet data-testid="institute-form-section-board">
                  <FieldLegend>{t('sections.schoolSpecific')}</FieldLegend>
                  <FieldDescription>{t('sections.schoolSpecificDescription')}</FieldDescription>

                  <form.AppField name="structureFramework">
                    {(field) => {
                      const value =
                        typeof field.state.value === 'string'
                          ? (field.state.value as (typeof FRAMEWORKS)[number])
                          : 'TRADITIONAL';
                      return (
                        <Field>
                          <FieldLabel htmlFor={field.name} className="flex items-center gap-1.5">
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
                            value={value}
                            onValueChange={(v) =>
                              field.handleChange(v as (typeof FRAMEWORKS)[number])
                            }
                          >
                            <SelectTrigger
                              id={field.name}
                              data-testid="admin-institute-new-framework-select"
                            >
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
                      );
                    }}
                  </form.AppField>

                  <form.AppField name="board">
                    {(field) => {
                      const value = typeof field.state.value === 'string' ? field.state.value : '';
                      const selected = BOARDS.find((b) => b === value);
                      return (
                        <Field>
                          <FieldLabel>{t('board')}</FieldLabel>
                          <FieldDescription>{t('boardDescription')}</FieldDescription>
                          <BoardCombobox
                            value={value}
                            onChange={(next) => field.handleChange(next)}
                            selectedLabel={selected ? t(`boards.${selected}`) : undefined}
                            t={t}
                          />
                        </Field>
                      );
                    }}
                  </form.AppField>

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
                            data-testid={`admin-institute-new-department-${dept}`}
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

              <FieldSet data-testid="institute-form-section-ownership">
                <FieldLegend>{t('sections.ownership')}</FieldLegend>
                <FieldDescription>{t('sections.ownershipDescription')}</FieldDescription>

                <form.AppField name="resellerId">
                  {(field) => {
                    const errors = fieldErrorMessages(field);
                    const invalid = errors.length > 0;
                    const value = typeof field.state.value === 'string' ? field.state.value : null;
                    return (
                      <Field data-invalid={invalid || undefined}>
                        <FieldLabel>{t('reseller')}</FieldLabel>
                        <FieldDescription>{t('resellerDescription')}</FieldDescription>
                        <ResellerCombobox
                          value={value}
                          onChange={(next) => field.handleChange(next)}
                          required
                          data-testid="admin-institute-new-reseller-combobox"
                        />
                        {invalid && <FieldError errors={errors} />}
                      </Field>
                    );
                  }}
                </form.AppField>

                <form.AppField name="groupId">
                  {(field) => {
                    const value = typeof field.state.value === 'string' ? field.state.value : null;
                    return (
                      <Field>
                        <FieldLabel>{t('group')}</FieldLabel>
                        <FieldDescription>{t('groupDescription')}</FieldDescription>
                        <InstituteGroupCombobox
                          value={value}
                          onChange={(next) => field.handleChange(next)}
                          data-testid="admin-institute-new-group-combobox"
                        />
                      </Field>
                    );
                  }}
                </form.AppField>
              </FieldSet>

              {/* ─── Section: Contact ────────────────────────────────── */}

              <FieldSet data-testid="institute-form-section-contact">
                <FieldLegend>{t('sections.contact')}</FieldLegend>
                <FieldDescription>{t('sections.contactDescription')}</FieldDescription>

                <Field>
                  <FieldLabel>{t('phones')}</FieldLabel>
                  <FieldDescription>{t('phonesDescription')}</FieldDescription>
                </Field>

                <form.Field name="contact.phones" mode="array">
                  {(arrayField) => {
                    const phones = (arrayField.state.value as ReadonlyArray<unknown>) ?? [];
                    const setPhonePrimary = (selectedIndex: number) => {
                      for (let i = 0; i < phones.length; i += 1) {
                        form.setFieldValue(`contact.phones[${i}].isPrimary`, i === selectedIndex);
                      }
                    };
                    return (
                      <>
                        <div className="space-y-3">
                          {phones.map((_, index) => (
                            <div
                              // biome-ignore lint/suspicious/noArrayIndexKey: phones reorder only via add/remove; index is stable per UX.
                              key={index}
                              className="grid grid-cols-[88px_1fr_auto_auto_1fr_auto] items-end gap-2 rounded-lg border p-3"
                            >
                              <form.AppField name={`contact.phones[${index}].countryCode`}>
                                {(field) => {
                                  const value =
                                    typeof field.state.value === 'string'
                                      ? field.state.value
                                      : '+91';
                                  return (
                                    <Field>
                                      <FieldLabel htmlFor={field.name} className="text-xs">
                                        {t('countryCode')}
                                      </FieldLabel>
                                      <Input
                                        id={field.name}
                                        name={field.name}
                                        value={value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        className="text-center"
                                        readOnly
                                        aria-readonly="true"
                                        aria-label={t('countryCode')}
                                      />
                                    </Field>
                                  );
                                }}
                              </form.AppField>

                              <form.AppField name={`contact.phones[${index}].number`}>
                                {(field) => {
                                  const errors = fieldErrorMessages(field);
                                  const invalid = errors.length > 0;
                                  const value =
                                    typeof field.state.value === 'string' ? field.state.value : '';
                                  return (
                                    <Field data-invalid={invalid || undefined}>
                                      <FieldLabel htmlFor={field.name} className="text-xs">
                                        {t('phoneNumber')}
                                      </FieldLabel>
                                      <Input
                                        id={field.name}
                                        name={field.name}
                                        data-testid={`admin-institute-new-phone-${index}-input`}
                                        inputMode="numeric"
                                        maxLength={12}
                                        placeholder={t('phonePlaceholder')}
                                        aria-invalid={invalid || undefined}
                                        aria-describedby={`phone-${index}-constraint`}
                                        value={value}
                                        onChange={(e) =>
                                          field.handleChange(
                                            e.target.value.replace(/\D/g, '').slice(0, 10),
                                          )
                                        }
                                        onBlur={() => {
                                          field.handleChange(formatIndianMobile(value));
                                          field.handleBlur();
                                        }}
                                      />
                                      <FieldDescription id={`phone-${index}-constraint`}>
                                        {t('phoneConstraint')}
                                      </FieldDescription>
                                      {invalid && <FieldError errors={errors} />}
                                    </Field>
                                  );
                                }}
                              </form.AppField>

                              <form.AppField name={`contact.phones[${index}].isPrimary`}>
                                {(field) => {
                                  const checked = field.state.value === true;
                                  return (
                                    <Field>
                                      <FieldLabel className="text-xs">{t('isPrimary')}</FieldLabel>
                                      <div className="flex h-8 items-center">
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={() => setPhonePrimary(index)}
                                          aria-label={t('isPrimary')}
                                        />
                                      </div>
                                    </Field>
                                  );
                                }}
                              </form.AppField>

                              <form.AppField name={`contact.phones[${index}].isWhatsappEnabled`}>
                                {(field) => {
                                  const checked = field.state.value === true;
                                  return (
                                    <Field>
                                      <FieldLabel className="text-xs">
                                        {t('isWhatsappEnabled')}
                                      </FieldLabel>
                                      <div className="flex h-8 items-center">
                                        <Switch
                                          checked={checked}
                                          onCheckedChange={(v) => field.handleChange(v === true)}
                                          aria-label={t('isWhatsappEnabled')}
                                        />
                                      </div>
                                      <FieldDescription>{t('whatsappHelp')}</FieldDescription>
                                    </Field>
                                  );
                                }}
                              </form.AppField>

                              <form.AppField name={`contact.phones[${index}].label`}>
                                {(field) => {
                                  const value =
                                    typeof field.state.value === 'string' ? field.state.value : '';
                                  return (
                                    <Field>
                                      <FieldLabel htmlFor={field.name} className="text-xs">
                                        {t('phoneLabel')}
                                      </FieldLabel>
                                      <Input
                                        id={field.name}
                                        name={field.name}
                                        value={value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder={t('phoneLabelPlaceholder')}
                                      />
                                    </Field>
                                  );
                                }}
                              </form.AppField>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => arrayField.removeValue(index)}
                                aria-label={t('removePhone')}
                                title={t('removePhone')}
                                disabled={phones.length <= 1}
                                data-testid={`admin-institute-new-remove-phone-${index}-btn`}
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
                            arrayField.pushValue({
                              countryCode: '+91',
                              number: '',
                              isPrimary: phones.length === 0,
                              isWhatsappEnabled: phones.length === 0,
                              label: '',
                            })
                          }
                          data-testid="admin-institute-new-add-phone-btn"
                        >
                          <Plus className="size-4" />
                          {t('addPhone')}
                        </Button>
                      </>
                    );
                  }}
                </form.Field>

                <FieldSeparator />

                <Field>
                  <FieldLabel>{t('emails')}</FieldLabel>
                  <FieldDescription>{t('emailsDescription')}</FieldDescription>
                </Field>

                <form.Field name="contact.emails" mode="array">
                  {(arrayField) => {
                    const emails = (arrayField.state.value as ReadonlyArray<unknown>) ?? [];
                    return (
                      <>
                        <div className="space-y-3">
                          {emails.map((_, index) => (
                            <div
                              // biome-ignore lint/suspicious/noArrayIndexKey: emails reorder only via add/remove; index is stable per UX.
                              key={index}
                              className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2 rounded-lg border p-3"
                            >
                              <form.AppField name={`contact.emails[${index}].address`}>
                                {(field) => {
                                  const errors = fieldErrorMessages(field);
                                  const invalid = errors.length > 0;
                                  const value =
                                    typeof field.state.value === 'string' ? field.state.value : '';
                                  return (
                                    <Field data-invalid={invalid || undefined}>
                                      <FieldLabel htmlFor={field.name} className="text-xs">
                                        {t('emailAddress')}
                                      </FieldLabel>
                                      <Input
                                        id={field.name}
                                        name={field.name}
                                        type="email"
                                        value={value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        data-testid={`admin-institute-new-email-${index}-input`}
                                        placeholder={t('emailPlaceholder')}
                                        aria-invalid={invalid || undefined}
                                      />
                                      {invalid && <FieldError errors={errors} />}
                                    </Field>
                                  );
                                }}
                              </form.AppField>

                              <form.AppField name={`contact.emails[${index}].isPrimary`}>
                                {(field) => {
                                  const checked = field.state.value === true;
                                  return (
                                    <Field>
                                      <FieldLabel className="text-xs">
                                        {t('emailIsPrimary')}
                                      </FieldLabel>
                                      <div className="flex h-8 items-center">
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(v) => field.handleChange(v === true)}
                                          aria-label={t('emailIsPrimary')}
                                        />
                                      </div>
                                    </Field>
                                  );
                                }}
                              </form.AppField>

                              <form.AppField name={`contact.emails[${index}].label`}>
                                {(field) => {
                                  const value =
                                    typeof field.state.value === 'string' ? field.state.value : '';
                                  return (
                                    <Field>
                                      <FieldLabel htmlFor={field.name} className="text-xs">
                                        {t('emailLabel')}
                                      </FieldLabel>
                                      <Input
                                        id={field.name}
                                        name={field.name}
                                        value={value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        placeholder={t('emailLabelPlaceholder')}
                                      />
                                    </Field>
                                  );
                                }}
                              </form.AppField>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => arrayField.removeValue(index)}
                                aria-label={t('removeEmail')}
                                title={t('removeEmail')}
                                data-testid={`admin-institute-new-remove-email-${index}-btn`}
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
                            arrayField.pushValue({ address: '', isPrimary: false, label: '' })
                          }
                          data-testid="admin-institute-new-add-email-btn"
                        >
                          <Plus className="size-4" />
                          {t('addEmail')}
                        </Button>
                      </>
                    );
                  }}
                </form.Field>
              </FieldSet>

              {/* ─── Section: Address ────────────────────────────────── */}

              <FieldSet data-testid="institute-form-section-address">
                <FieldLegend>{t('sections.address')}</FieldLegend>
                <FieldDescription>{t('sections.addressDescription')}</FieldDescription>

                <form.AppField name="address.line1">
                  {(field) => (
                    <field.TextField
                      label={t('line1')}
                      placeholder={t('line1Placeholder')}
                      testId="admin-institute-new-address-line1-input"
                    />
                  )}
                </form.AppField>

                <form.AppField name="address.line2">
                  {(field) => (
                    <field.TextField
                      label={t('line2')}
                      placeholder={t('line2Placeholder')}
                      testId="admin-institute-new-address-line2-input"
                    />
                  )}
                </form.AppField>

                <form.AppField name="address.postalCode">
                  {(field) => {
                    const errors = fieldErrorMessages(field);
                    const invalid = errors.length > 0;
                    const value = typeof field.state.value === 'string' ? field.state.value : '';
                    return (
                      <Field data-invalid={invalid || undefined}>
                        <FieldLabel htmlFor={field.name}>{t('postalCode')}</FieldLabel>
                        <FieldDescription>{t('postalCodeDescription')}</FieldDescription>
                        <Input
                          id={field.name}
                          name={field.name}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder={t('postalCodePlaceholder')}
                          aria-invalid={invalid || undefined}
                          value={value}
                          onChange={(e) =>
                            field.handleChange(e.target.value.replace(/\D/g, '').slice(0, 6))
                          }
                          onBlur={() => {
                            field.handleBlur();
                            void handlePinLookup(value);
                          }}
                          data-testid="admin-institute-new-postal-code-input"
                        />
                        {invalid && <FieldError errors={errors} />}
                      </Field>
                    );
                  }}
                </form.AppField>

                <div className="grid grid-cols-2 gap-4">
                  <form.AppField name="address.city">
                    {(field) => (
                      <field.TextField
                        label={t('city')}
                        placeholder={t('cityPlaceholder')}
                        testId="admin-institute-new-city-input"
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="address.district">
                    {(field) => (
                      <field.TextField
                        label={t('district')}
                        placeholder={t('districtPlaceholder')}
                        testId="admin-institute-new-district-input"
                      />
                    )}
                  </form.AppField>
                </div>

                <form.AppField name="address.state">
                  {(field) => {
                    const errors = fieldErrorMessages(field);
                    const invalid = errors.length > 0;
                    const value = typeof field.state.value === 'string' ? field.state.value : '';
                    return (
                      <Field data-invalid={invalid || undefined}>
                        <FieldLabel>{t('state')}</FieldLabel>
                        <StateCombobox
                          value={value}
                          onChange={(next) => field.handleChange(next)}
                          t={t}
                          tGeo={tGeo}
                        />
                        {invalid && <FieldError errors={errors} />}
                      </Field>
                    );
                  }}
                </form.AppField>

                {addressPreview && (
                  <Field>
                    <FieldLabel>{t('addressPreview')}</FieldLabel>
                    <p
                      className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground"
                      aria-live="polite"
                      data-testid="admin-institute-new-address-preview"
                    >
                      {addressPreview}
                    </p>
                  </Field>
                )}
              </FieldSet>

              {/* ─── Section: Advanced ───────────────────────────────── */}

              <FieldSet data-testid="institute-form-section-advanced">
                <FieldLegend>{t('sections.advanced')}</FieldLegend>

                <form.AppField name="isDemo">
                  {(field) => {
                    const checked = field.state.value === true;
                    return (
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldLabel htmlFor={field.name}>{t('isDemo')}</FieldLabel>
                          <FieldDescription>{t('isDemoDescription')}</FieldDescription>
                        </FieldContent>
                        <Switch
                          id={field.name}
                          checked={checked}
                          onCheckedChange={(v) => field.handleChange(v === true)}
                          aria-label={t('isDemo')}
                          data-testid="admin-institute-new-is-demo-switch"
                        />
                      </Field>
                    );
                  }}
                </form.AppField>
              </FieldSet>
            </FieldGroup>

            <div className="mt-6 flex justify-end">
              <form.AppForm>
                <form.SubmitButton
                  testId="create-institute-submit-btn"
                  submittingLabel={t('creating')}
                >
                  {t('submit')}
                </form.SubmitButton>
              </form.AppForm>
            </div>
          </form>
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
  tGeo: ReturnType<typeof useTranslations>;
}

function StateCombobox({ value, onChange, t, tGeo }: StateComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = value ? tGeo(`states.${value}`) : '';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t('statePlaceholder')}
          className="w-full justify-between font-normal"
          data-testid="admin-institute-new-state-combobox"
        >
          <span className={value ? '' : 'text-muted-foreground'}>
            {selectedLabel || t('statePlaceholder')}
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
              {INDIAN_STATE_VALUES.map((state) => (
                <CommandItem
                  key={state}
                  value={tGeo(`states.${state}`)}
                  onSelect={() => {
                    onChange(state);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 size-4 ${value === state ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {tGeo(`states.${state}`)}
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
          aria-label={t('boardPlaceholder')}
          className="w-full justify-between font-normal"
          data-testid="admin-institute-new-board-combobox"
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
