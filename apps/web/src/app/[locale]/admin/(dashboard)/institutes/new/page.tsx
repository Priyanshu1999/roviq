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
  Switch,
} from '@roviq/ui';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormProvider, type Resolver, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useCreateInstitute } from '../use-institutes';

// Contact/address schemas (shared with institute settings)
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

const addressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required.'),
  line2: z.string().optional().default(''),
  line3: z.string().optional().default(''),
  city: z.string().min(1, 'City is required.'),
  district: z.string().min(1, 'District is required.'),
  state: z.string().min(1, 'State is required.'),
  postal_code: z.string().regex(/^\d{6}$/, 'PIN code must be exactly 6 digits.'),
  country: z.string().default('IN'),
  coordinates: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
});

const INSTITUTE_TYPES = ['SCHOOL', 'COACHING', 'LIBRARY'] as const;
const FRAMEWORKS = ['NEP', 'TRADITIONAL'] as const;
const BOARDS = ['cbse', 'bseh', 'rbse', 'icse'] as const;
const DEPARTMENTS = [
  'pre_primary',
  'primary',
  'upper_primary',
  'secondary',
  'senior_secondary',
] as const;

const createInstituteSchema = z.object({
  name: i18nTextSchema,
  code: z.string().min(1, 'Code is required.').max(50),
  slug: z.string().optional(),
  type: z.enum(INSTITUTE_TYPES),
  structureFramework: z.enum(FRAMEWORKS).optional(),
  board: z.string().optional(),
  departments: z.array(z.string()).optional(),
  contact: contactSchema.optional(),
  address: addressSchema.optional(),
  isDemo: z.boolean().default(false),
});

type CreateInstituteFormValues = z.infer<typeof createInstituteSchema>;

export default function CreateInstitutePage() {
  const t = useTranslations('adminInstitutes.create');
  const router = useRouter();
  const [createInstitute] = useCreateInstitute();

  const form = useForm<CreateInstituteFormValues>({
    resolver: zodResolver(createInstituteSchema) as Resolver<CreateInstituteFormValues>,
    defaultValues: {
      name: { en: '' },
      code: '',
      type: 'SCHOOL',
      structureFramework: 'TRADITIONAL',
      board: 'cbse',
      departments: [],
      contact: { phones: [], emails: [] },
      isDemo: false,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const instituteType = watch('type');
  const isSchool = instituteType === 'SCHOOL';
  const selectedDepartments = watch('departments') ?? [];

  function toggleDepartment(dept: string) {
    const current = selectedDepartments;
    const updated = current.includes(dept) ? current.filter((d) => d !== dept) : [...current, dept];
    setValue('departments', updated, { shouldDirty: true });
  }

  const onSubmit = async (values: CreateInstituteFormValues) => {
    const slug = values.code
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

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
            contact: values.contact,
            address: values.address,
            isDemo: values.isDemo,
          },
        },
      });
      toast.success(t('success'));
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
                <I18nInput<CreateInstituteFormValues>
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
                      setValue('type', v as CreateInstituteFormValues['type'], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('typePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTITUTE_TYPES.map((tp) => (
                        <SelectItem key={tp} value={tp}>
                          {t(`../types.${tp}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

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

                <FieldSeparator />

                <Field>
                  <div className="flex items-center justify-between">
                    <div>
                      <FieldLabel>{t('isDemo')}</FieldLabel>
                      <FieldDescription>{t('isDemoDescription')}</FieldDescription>
                    </div>
                    <Switch
                      checked={watch('isDemo')}
                      onCheckedChange={(v) => setValue('isDemo', v, { shouldDirty: true })}
                    />
                  </div>
                </Field>
              </FieldGroup>

              <div className="mt-6 flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
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
