'use client';

import { INDIAN_STATE_VALUES } from '@roviq/common-types';
import { extractGraphQLError } from '@roviq/graphql';
import { emptyStringToUndefined, i18nTextSchema } from '@roviq/i18n';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  I18nField,
  useAppForm,
} from '@roviq/ui';
import { useStore } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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

/** Academic departments (school-only) — must match EducationLevel pgEnum values (UPPER_CASE). */
const DEPARTMENTS = [
  'PRE_PRIMARY',
  'PRIMARY',
  'UPPER_PRIMARY',
  'SECONDARY',
  'SENIOR_SECONDARY',
] as const;

// ─── Schemas ─────────────────────────────────────────────────────────────────

const phoneEntrySchema = z.object({
  country_code: z.string().default('+91'),
  number: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits.'),
  is_primary: z.boolean().default(false),
  is_whatsapp_enabled: z.boolean().default(false),
  label: z.string().max(50).default(''),
});

const schema = z.object({
  name: i18nTextSchema,
  code: z.string().min(1, 'Code is required.').max(50),
  type: z.enum(TYPES),
  structureFramework: z.enum(FRAMEWORKS).optional(),
  board: emptyStringToUndefined(z.string().optional()),
  departments: z.array(z.string()).default([]),
  group: emptyStringToUndefined(z.string().optional()),
  phones: z.array(phoneEntrySchema),
  addressLine1: emptyStringToUndefined(z.string().optional()),
  city: emptyStringToUndefined(z.string().optional()),
  district: emptyStringToUndefined(z.string().optional()),
  state: emptyStringToUndefined(z.string().optional()),
  postalCode: emptyStringToUndefined(z.string().optional()),
});

type FormSchema = typeof schema;
type FormValues = z.input<FormSchema>;

const DEFAULT_PHONE = {
  country_code: '+91',
  number: '',
  is_primary: true,
  is_whatsapp_enabled: true,
  label: '',
} as const;

// ─── Page Component ──────────────────────────────────────────────────────────

export default function ResellerCreateInstitutePage() {
  const t = useTranslations('resellerInstitutes.create');
  const tGeo = useTranslations('geography');
  const router = useRouter();
  const [createRequest] = useResellerCreateInstituteRequest();

  const form = useAppForm({
    defaultValues: {
      name: { en: '' },
      code: '',
      type: 'SCHOOL',
      structureFramework: 'TRADITIONAL',
      board: 'cbse',
      departments: [],
      group: '',
      phones: [{ ...DEFAULT_PHONE }],
      addressLine1: '',
      city: '',
      district: '',
      state: '',
      postalCode: '',
    } satisfies FormValues,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      const slug = parsed.code
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const filteredPhones = parsed.phones.filter((p) => p.number);
      const contact =
        filteredPhones.length > 0 ? { phones: filteredPhones, emails: [] } : undefined;

      const address = parsed.addressLine1
        ? {
            line1: parsed.addressLine1,
            line2: '',
            line3: '',
            city: parsed.city ?? '',
            district: parsed.district ?? '',
            state: parsed.state ?? '',
            postalCode: parsed.postalCode ?? '',
            country: 'IN',
          }
        : undefined;

      const isSchoolType = parsed.type === 'SCHOOL';

      try {
        await createRequest({
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
              address,
            },
          },
        });
        toast.success(t('success'));
        router.push('/reseller/institutes');
      } catch (err) {
        const message = extractGraphQLError(err, t('error'));
        if (message.includes('INSTITUTE_CODE_DUPLICATE') || message.includes('already exists')) {
          form.setFieldMeta('code', (prev) => ({
            ...prev,
            errorMap: { onChange: t('codeDuplicate') },
          }));
        } else {
          toast.error(t('error'), { description: message });
        }
      }
    },
  });

  // Cascading: selectively render school-only sections off the live `type`.
  const instituteType = useStore(form.store, (s) => (s.values as FormValues).type);
  const isSchool = instituteType === 'SCHOOL';
  const selectedDepartments = useStore(
    form.store,
    (s) => (s.values as FormValues).departments ?? [],
  );

  function toggleDepartment(dept: string) {
    const current = (form.state.values as FormValues).departments ?? [];
    const updated = current.includes(dept) ? current.filter((d) => d !== dept) : [...current, dept];
    // TanStack's `setFieldValue` typed name union elides `string[]`-typed
    // fields whose schema uses `.default([])` — `departments` resolves to
    // `string[] | undefined` at the input layer and is filtered out of the
    // generated DeepKeys set. The runtime call is correct; the suppression
    // applies only to the field-name overload, not the value type.
    // @ts-expect-error — see comment above; remove if upstream tightens DeepKeys.
    form.setFieldValue('departments', updated);
  }

  const typeOptions = TYPES.map((tp) => ({ value: tp, label: tp }));
  const frameworkOptions = FRAMEWORKS.map((fw) => ({ value: fw, label: t(`frameworks.${fw}`) }));
  const boardOptions = BOARDS.map((b) => ({ value: b, label: t(`boards.${b}`) }));
  const stateOptions = INDIAN_STATE_VALUES.map((s) => ({
    value: s,
    label: tGeo(`states.${s}`),
  }));

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
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
          >
            <FieldGroup>
              {/* ─── Identity ──────────────────────────────────────────── */}

              <I18nField
                form={form}
                name="name"
                label={t('name')}
                placeholder={t('namePlaceholder')}
              />

              <form.AppField name="code">
                {(field) => (
                  <field.TextField
                    label={t('code')}
                    description={t('codeDescription')}
                    placeholder={t('codePlaceholder')}
                  />
                )}
              </form.AppField>

              <form.AppField name="type">
                {(field) => (
                  <field.SelectField
                    label={t('type')}
                    options={typeOptions}
                    placeholder={t('typePlaceholder')}
                    optional={false}
                  />
                )}
              </form.AppField>

              {/* ─── School-specific fields ────────────────────────────── */}

              {isSchool && (
                <>
                  <form.AppField name="structureFramework">
                    {(field) => (
                      <field.SelectField
                        label={t('structureFramework')}
                        description={t('structureFrameworkDescription')}
                        options={frameworkOptions}
                        optional={false}
                      />
                    )}
                  </form.AppField>

                  <form.AppField name="board">
                    {(field) => (
                      <field.SelectField
                        label={t('board')}
                        options={boardOptions}
                        placeholder={t('boardPlaceholder')}
                      />
                    )}
                  </form.AppField>

                  <Field>
                    <FieldLabel>{t('departments')}</FieldLabel>
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

              <form.AppField name="group">
                {(field) => (
                  <field.TextField
                    label={t('group')}
                    description={t('groupDescription')}
                    placeholder={t('groupPlaceholder')}
                  />
                )}
              </form.AppField>

              {/* ─── Contact ───────────────────────────────────────────── */}

              <FieldSeparator>{t('contact')}</FieldSeparator>

              <form.Field name="phones" mode="array">
                {(phonesField) => (
                  <>
                    {phonesField.state.value.map((_, index) => (
                      <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: phones array reorders only via add/remove; index is stable for this UX.
                        key={index}
                        className="grid grid-cols-[70px_1fr_auto] items-end gap-2 rounded-lg border p-3"
                      >
                        <form.AppField name={`phones[${index}].country_code` as const}>
                          {(field) => <field.TextField label={t('countryCode')} disabled />}
                        </form.AppField>
                        <form.AppField name={`phones[${index}].number` as const}>
                          {(field) => (
                            <field.TextField
                              label={t('phoneNumber')}
                              placeholder={t('phonePlaceholder')}
                              inputMode="numeric"
                              maxLength={10}
                            />
                          )}
                        </form.AppField>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => phonesField.removeValue(index)}
                          disabled={phonesField.state.value.length <= 1}
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
                        phonesField.pushValue({
                          ...DEFAULT_PHONE,
                          is_primary: false,
                          is_whatsapp_enabled: false,
                        })
                      }
                    >
                      {t('addPhone')}
                    </Button>
                  </>
                )}
              </form.Field>

              {/* ─── Address ───────────────────────────────────────────── */}

              <FieldSeparator>{t('address')}</FieldSeparator>

              <form.AppField name="addressLine1">
                {(field) => (
                  <field.TextField label={t('line1')} placeholder={t('line1Placeholder')} />
                )}
              </form.AppField>

              <div className="grid grid-cols-2 gap-4">
                <form.AppField name="city">
                  {(field) => (
                    <field.TextField label={t('city')} placeholder={t('cityPlaceholder')} />
                  )}
                </form.AppField>
                <form.AppField name="district">
                  {(field) => (
                    <field.TextField label={t('district')} placeholder={t('districtPlaceholder')} />
                  )}
                </form.AppField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <form.AppField name="state">
                  {(field) => (
                    <field.SelectField
                      label={t('state')}
                      options={stateOptions}
                      placeholder={t('statePlaceholder')}
                    />
                  )}
                </form.AppField>
                <form.AppField name="postalCode">
                  {(field) => (
                    <field.TextField
                      label={t('postalCode')}
                      placeholder={t('postalCodePlaceholder')}
                      inputMode="numeric"
                      maxLength={6}
                    />
                  )}
                </form.AppField>
              </div>
            </FieldGroup>

            <div className="mt-6 flex justify-end">
              <form.AppForm>
                <form.SubmitButton submittingLabel={t('submitting')}>
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
