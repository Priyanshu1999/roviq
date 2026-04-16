'use client';

import { extractGraphQLError } from '@roviq/graphql';
import { emptyStringToUndefined, phoneSchema } from '@roviq/i18n';
import {
  Button,
  FieldGroup,
  FieldLegend,
  FieldSet,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  useAppForm,
} from '@roviq/ui';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ENQUIRY_SOURCE_VALUES, type EnquirySourceKey } from '../admission-constants';
import { useCreateEnquiry } from '../use-admission';

/** Canonical gender + relationship enums mirroring the backend. */
const GENDERS = ['MALE', 'FEMALE', 'OTHER'] as const;
const RELATIONSHIPS = [
  'FATHER',
  'MOTHER',
  'GRANDPARENT_PATERNAL',
  'GRANDPARENT_MATERNAL',
  'UNCLE',
  'AUNT',
  'SIBLING',
  'LEGAL_GUARDIAN',
  'OTHER',
] as const;

const ENQUIRY_SOURCE_TUPLE = ENQUIRY_SOURCE_VALUES as unknown as readonly [
  EnquirySourceKey,
  ...EnquirySourceKey[],
];

/** Build a Zod schema keyed on translation function so errors localise. */
function buildSchema(t: ReturnType<typeof useTranslations>) {
  return z.object({
    studentName: z.string().min(1, t('enquiries.newForm.errors.studentNameRequired')).max(200),
    dateOfBirth: emptyStringToUndefined(z.string().optional()),
    gender: emptyStringToUndefined(z.enum(GENDERS).optional()),
    classRequested: z.string().min(1, t('enquiries.newForm.errors.classRequiredRequired')).max(50),
    parentName: z.string().min(1, t('enquiries.newForm.errors.parentNameRequired')).max(200),
    parentPhone: phoneSchema(t('enquiries.newForm.errors.parentPhoneInvalid')),
    parentEmail: emptyStringToUndefined(
      z.email({ error: t('enquiries.newForm.errors.emailInvalid') }).optional(),
    ),
    parentRelation: emptyStringToUndefined(z.enum(RELATIONSHIPS).optional()),
    source: emptyStringToUndefined(z.enum(ENQUIRY_SOURCE_TUPLE).optional()),
    referredBy: emptyStringToUndefined(z.string().max(200).optional()),
    previousSchool: emptyStringToUndefined(z.string().max(200).optional()),
    followUpDate: emptyStringToUndefined(z.string().optional()),
    notes: emptyStringToUndefined(z.string().max(2000).optional()),
  });
}

type EnquirySchema = ReturnType<typeof buildSchema>;
type EnquiryFormValues = z.input<EnquirySchema>;

const EMPTY_DEFAULTS: EnquiryFormValues = {
  studentName: '',
  dateOfBirth: '',
  gender: undefined,
  classRequested: '',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  parentRelation: undefined,
  source: undefined,
  referredBy: '',
  previousSchool: '',
  followUpDate: '',
  notes: '',
};

export interface EnquiryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (enquiryId: string) => void;
}

/**
 * Slide-over form for creating a new admission enquiry. Implements rule
 * [QIGCL] by defaulting to `side="right"` Sheet — desktop shows as slide-over,
 * mobile falls back to the full-screen sheet variant via viewport styling.
 */
export function EnquiryFormSheet({ open, onOpenChange, onCreated }: EnquiryFormSheetProps) {
  const t = useTranslations('admission');
  const [createEnquiry] = useCreateEnquiry();

  const schema = React.useMemo(() => buildSchema(t), [t]);

  const form = useAppForm({
    defaultValues: EMPTY_DEFAULTS,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      try {
        const result = await createEnquiry({
          variables: {
            input: {
              studentName: parsed.studentName,
              dateOfBirth: parsed.dateOfBirth,
              gender: parsed.gender,
              classRequested: parsed.classRequested,
              parentName: parsed.parentName,
              parentPhone: parsed.parentPhone.replace(/\D/g, ''),
              parentEmail: parsed.parentEmail,
              parentRelation: parsed.parentRelation,
              source: parsed.source,
              referredBy: parsed.referredBy,
              previousSchool: parsed.previousSchool,
              followUpDate: parsed.followUpDate,
              notes: parsed.notes,
            },
          },
        });
        toast.success(t('enquiries.newForm.success'));
        const id = result.data?.createEnquiry.id;
        onOpenChange(false);
        if (id) onCreated?.(id);
      } catch (err) {
        const message = extractGraphQLError(err, t('enquiries.newForm.errors.generic'));
        if (message.includes('DUPLICATE') || message.includes('duplicate')) {
          // Surface the duplicate-phone error both as a toast and as an inline
          // field error so the user immediately sees which field is at fault.
          // TanStack Form exposes per-source error slots via `setFieldMeta`;
          // populating `onSubmit` mirrors what the validator path would do.
          const duplicateMsg = t('enquiries.newForm.errors.duplicate');
          toast.error(duplicateMsg);
          form.setFieldMeta('parentPhone', (prev) => ({
            ...prev,
            isTouched: true,
            errorMap: { ...prev.errorMap, onSubmit: duplicateMsg },
          }));
        } else {
          toast.error(t('enquiries.newForm.errors.generic'), { description: message });
        }
      }
    },
  });

  // Reset the form each time the sheet is reopened. If the user closed the
  // sheet mid-edit we don't retain the stale values — that's a deliberate
  // UX trade-off for this lightweight slide-over.
  React.useEffect(() => {
    if (open) {
      form.reset(EMPTY_DEFAULTS);
    }
  }, [open, form]);

  const genderOptions = GENDERS.map((g) => ({ value: g, label: t(`genders.${g}`) }));
  const relationshipOptions = RELATIONSHIPS.map((r) => ({
    value: r,
    label: t(`relationships.${r}`),
  }));
  const sourceOptions = ENQUIRY_SOURCE_VALUES.map((s) => ({ value: s, label: t(`sources.${s}`) }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle data-testid="enquiry-form-title">{t('enquiries.newForm.title')}</SheetTitle>
          <SheetDescription>{t('enquiries.newForm.description')}</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          noValidate
          className="space-y-6 px-4 pb-24"
          data-testid="enquiry-form"
        >
          <FieldSet>
            <FieldLegend>{t('enquiries.newForm.sections.student')}</FieldLegend>
            <FieldGroup>
              <form.AppField name="studentName">
                {(field) => (
                  <field.TextField
                    label={t('enquiries.newForm.fields.studentName')}
                    placeholder={t('enquiries.newForm.placeholders.studentName')}
                    testId="enquiry-student-name-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="dateOfBirth">
                {(field) => (
                  <field.DateField
                    label={t('enquiries.newForm.fields.dateOfBirth')}
                    testId="enquiry-dob-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="gender">
                {(field) => (
                  <field.SelectField
                    label={t('enquiries.newForm.fields.gender')}
                    options={genderOptions}
                    placeholder={t('enquiries.newForm.fields.gender')}
                    testId="enquiry-gender-select"
                  />
                )}
              </form.AppField>

              <form.AppField name="classRequested">
                {(field) => (
                  <field.TextField
                    label={t('enquiries.newForm.fields.classRequested')}
                    placeholder={t('enquiries.newForm.placeholders.classRequested')}
                    testId="enquiry-class-input"
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>{t('enquiries.newForm.sections.parent')}</FieldLegend>
            <FieldGroup>
              <form.AppField name="parentName">
                {(field) => (
                  <field.TextField
                    label={t('enquiries.newForm.fields.parentName')}
                    placeholder={t('enquiries.newForm.placeholders.parentName')}
                    testId="enquiry-parent-name-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="parentPhone">
                {(field) => (
                  <field.PhoneField
                    label={t('enquiries.newForm.fields.parentPhone')}
                    description={t('enquiries.newForm.placeholders.parentPhoneHint')}
                    placeholder={t('enquiries.newForm.placeholders.parentPhone')}
                    testId="enquiry-parent-phone-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="parentEmail">
                {(field) => (
                  <field.TextField
                    label={t('enquiries.newForm.fields.parentEmail')}
                    type="email"
                    placeholder={t('enquiries.newForm.placeholders.parentEmail')}
                    testId="enquiry-parent-email-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="parentRelation">
                {(field) => (
                  <field.SelectField
                    label={t('enquiries.newForm.fields.parentRelation')}
                    options={relationshipOptions}
                    placeholder={t('enquiries.newForm.fields.parentRelation')}
                    testId="enquiry-relation-select"
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>{t('enquiries.newForm.sections.source')}</FieldLegend>
            <FieldGroup>
              <form.AppField name="source">
                {(field) => (
                  <field.SelectField
                    label={t('enquiries.newForm.fields.source')}
                    options={sourceOptions}
                    placeholder={t('enquiries.newForm.fields.source')}
                    testId="enquiry-source-select"
                  />
                )}
              </form.AppField>

              <form.AppField name="referredBy">
                {(field) => (
                  <field.TextField
                    label={t('enquiries.newForm.fields.referredBy')}
                    placeholder={t('enquiries.newForm.placeholders.referredBy')}
                  />
                )}
              </form.AppField>

              <form.AppField name="previousSchool">
                {(field) => (
                  <field.TextField
                    label={t('enquiries.newForm.fields.previousSchool')}
                    placeholder={t('enquiries.newForm.placeholders.previousSchool')}
                  />
                )}
              </form.AppField>

              <form.AppField name="followUpDate">
                {(field) => (
                  <field.DateField
                    label={t('enquiries.newForm.fields.followUpDate')}
                    testId="enquiry-followup-input"
                  />
                )}
              </form.AppField>

              <form.AppField name="notes">
                {(field) => (
                  <field.TextareaField
                    label={t('enquiries.newForm.fields.notes')}
                    rows={3}
                    placeholder={t('enquiries.newForm.placeholders.notes')}
                  />
                )}
              </form.AppField>
            </FieldGroup>
          </FieldSet>

          <SheetFooter className="sticky bottom-0 border-t bg-background pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="enquiry-form-cancel-btn"
            >
              {t('enquiries.newForm.cancel')}
            </Button>
            <form.AppForm>
              <form.SubmitButton
                testId="enquiry-form-submit-btn"
                submittingLabel={t('enquiries.newForm.submitting')}
              >
                {t('enquiries.newForm.submit')}
              </form.SubmitButton>
            </form.AppForm>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
