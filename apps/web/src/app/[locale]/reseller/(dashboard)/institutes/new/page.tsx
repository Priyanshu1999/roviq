'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { extractGraphQLError } from '@roviq/graphql';
import { i18nTextSchema } from '@roviq/i18n';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  I18nInput,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider, type Resolver, useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useResellerCreateInstituteRequest } from '../use-reseller-institutes';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Available institute types on the platform. */
const TYPES = ['SCHOOL', 'COACHING', 'LIBRARY'] as const;

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

const schema = z.object({
  name: i18nTextSchema,
  code: z.string().min(1, 'Code is required.').max(50),
  type: z.enum(TYPES),
  structureFramework: z.enum(FRAMEWORKS).optional(),
  board: z.string().optional(),
  departments: z.array(z.string()).optional(),
  group: z.string().optional(),
  phones: z.array(phoneSchema).default([
    {
      country_code: '+91',
      number: '',
      is_primary: true,
      is_whatsapp_enabled: true,
      label: '',
    },
  ]),
  emails: z.array(emailSchema).default([]),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ResellerCreateInstitutePage() {
  const t = useTranslations('resellerInstitutes.create');
  const router = useRouter();
  const [createRequest] = useResellerCreateInstituteRequest();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      name: { en: '' },
      code: '',
      type: 'SCHOOL',
      structureFramework: 'TRADITIONAL',
      board: 'cbse',
      departments: [],
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
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = form;

  const instituteType = watch('type');
  const isSchool = instituteType === 'SCHOOL';
  const selectedDepartments = watch('departments') ?? [];

  const {
    fields: phoneFields,
    append: appendPhone,
    remove: removePhone,
  } = useFieldArray({ control, name: 'phones' });

  function toggleDepartment(dept: string) {
    const updated = selectedDepartments.includes(dept)
      ? selectedDepartments.filter((d) => d !== dept)
      : [...selectedDepartments, dept];
    setValue('departments', updated, { shouldDirty: true });
  }

  // ─── Submit ──────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    const slug = values.code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const contact = {
      phones: values.phones.filter((p) => p.number),
      emails: values.emails.filter((e) => e.address),
    };

    const address = values.addressLine1
      ? {
          line1: values.addressLine1,
          line2: '',
          line3: '',
          city: values.city ?? '',
          district: values.district ?? '',
          state: values.state ?? '',
          postal_code: values.postalCode ?? '',
          country: 'IN',
        }
      : undefined;

    try {
      await createRequest({
        variables: {
          input: {
            name: values.name,
            code: values.code,
            slug,
            type: values.type,
            structureFramework: isSchool ? values.structureFramework : undefined,
            board: isSchool ? values.board : undefined,
            departments: isSchool ? values.departments : undefined,
            contact: contact.phones.length > 0 || contact.emails.length > 0 ? contact : undefined,
            address,
          },
        },
      });
      toast.success(t('success'));
      router.push('/reseller/institutes');
    } catch (err) {
      const message = extractGraphQLError(err, t('error'));
      if (message.includes('INSTITUTE_CODE_DUPLICATE') || message.includes('already exists')) {
        setError('code', { message: t('codeDuplicate') });
      } else {
        toast.error(t('error'), { description: message });
      }
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <FormProvider {...form}>
            <form onSubmit={handleSubmit(onSubmit)}>
              <FieldGroup>
                {/* ─── Identity ──────────────────────────────────────────── */}

                <I18nInput<FormValues>
                  name="name"
                  label={t('name')}
                  required
                  placeholder={t('namePlaceholder')}
                />

                <Field data-invalid={!!errors.code}>
                  <FieldLabel htmlFor="code">{t('code')}</FieldLabel>
                  <FieldDescription>{t('codeDescription')}</FieldDescription>
                  <Input
                    id="code"
                    {...register('code')}
                    placeholder={t('codePlaceholder')}
                    aria-invalid={!!errors.code}
                  />
                  {errors.code && <FieldError errors={[errors.code]} />}
                </Field>

                <Field>
                  <FieldLabel>{t('type')}</FieldLabel>
                  <Select
                    value={instituteType}
                    onValueChange={(v) =>
                      setValue('type', v as FormValues['type'], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('typePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((tp) => (
                        <SelectItem key={tp} value={tp}>
                          {tp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* ─── School-specific fields ────────────────────────────── */}

                {isSchool && (
                  <>
                    <Field>
                      <FieldLabel>{t('structureFramework')}</FieldLabel>
                      <FieldDescription>{t('structureFrameworkDescription')}</FieldDescription>
                      <Select
                        value={watch('structureFramework') ?? 'TRADITIONAL'}
                        onValueChange={(v) =>
                          setValue('structureFramework', v as 'NEP' | 'TRADITIONAL', {
                            shouldDirty: true,
                          })
                        }
                      >
                        <SelectTrigger>
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

                    <Field>
                      <FieldLabel>{t('board')}</FieldLabel>
                      <Select
                        value={watch('board') ?? 'cbse'}
                        onValueChange={(v) => setValue('board', v, { shouldDirty: true })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('boardPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {BOARDS.map((b) => (
                            <SelectItem key={b} value={b}>
                              {t(`boards.${b}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel>{t('departments')}</FieldLabel>
                      <FieldDescription>{t('departmentsDescription')}</FieldDescription>
                      <div className="flex flex-wrap gap-3">
                        {DEPARTMENTS.map((dept) => (
                          <div key={dept} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              id={`dept-${dept}`}
                              checked={selectedDepartments.includes(dept)}
                              onCheckedChange={() => toggleDepartment(dept)}
                            />
                            <FieldLabel
                              htmlFor={`dept-${dept}`}
                              className="cursor-pointer font-normal"
                            >
                              {t(`departmentOptions.${dept}`)}
                            </FieldLabel>
                          </div>
                        ))}
                      </div>
                    </Field>
                  </>
                )}

                {/* ─── Group ──────────────────────────────────────────────── */}

                <Field>
                  <FieldLabel>{t('group')}</FieldLabel>
                  <FieldDescription>{t('groupDescription')}</FieldDescription>
                  <Input {...register('group')} placeholder={t('groupPlaceholder')} />
                </Field>

                {/* ─── Contact ───────────────────────────────────────────── */}

                <FieldSeparator>{t('contact')}</FieldSeparator>

                {phoneFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="grid grid-cols-[70px_1fr_auto] items-end gap-2 rounded-lg border p-3"
                  >
                    <Field>
                      <FieldLabel className="text-xs">{t('countryCode')}</FieldLabel>
                      <Input
                        {...register(`phones.${index}.country_code`)}
                        readOnly
                        className="text-center"
                      />
                    </Field>
                    <Field>
                      <FieldLabel className="text-xs">{t('phoneNumber')}</FieldLabel>
                      <Input
                        {...register(`phones.${index}.number`)}
                        placeholder={t('phonePlaceholder')}
                        inputMode="numeric"
                        maxLength={10}
                      />
                    </Field>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removePhone(index)}
                      disabled={phoneFields.length <= 1}
                    >
                      {t('removePhone')}
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    appendPhone({
                      country_code: '+91',
                      number: '',
                      is_primary: false,
                      is_whatsapp_enabled: false,
                      label: '',
                    })
                  }
                >
                  {t('addPhone')}
                </Button>

                {/* ─── Address ───────────────────────────────────────────── */}

                <FieldSeparator>{t('address')}</FieldSeparator>

                <Field>
                  <FieldLabel>{t('line1')}</FieldLabel>
                  <Input {...register('addressLine1')} placeholder={t('line1Placeholder')} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t('city')}</FieldLabel>
                    <Input {...register('city')} placeholder={t('cityPlaceholder')} />
                  </Field>
                  <Field>
                    <FieldLabel>{t('district')}</FieldLabel>
                    <Input {...register('district')} placeholder={t('districtPlaceholder')} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>{t('state')}</FieldLabel>
                    <Select
                      value={watch('state') ?? ''}
                      onValueChange={(v) => setValue('state', v, { shouldDirty: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('statePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel>{t('postalCode')}</FieldLabel>
                    <Input
                      {...register('postalCode')}
                      placeholder={t('postalCodePlaceholder')}
                      inputMode="numeric"
                      maxLength={6}
                    />
                  </Field>
                </div>
              </FieldGroup>

              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('submitting')}
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
