'use client';

import {
  Button,
  Checkbox,
  Field,
  FieldError,
  FieldLabel,
  FieldSet,
  fieldErrorMessages,
  Input,
  Switch,
} from '@roviq/ui';
import { type AnyFieldApi, useStore } from '@tanstack/react-form';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InstituteInfoFormValues } from '../schemas';

// The TanStack `useAppForm()` return type has many contravariant slots that
// collapse to `never` under any narrower duck-type, rejecting structural
// matching. The kit boundary therefore accepts `form: any` and trusts the
// consumer to pass a real `useAppForm` result; runtime safety is preserved
// via `state.values` access patterns below.
// biome-ignore lint/suspicious/noExplicitAny: kit boundary is intentionally loose; runtime is constrained by useAppForm.
type AnyForm = any;

export interface ContactBuilderProps {
  form: AnyForm;
}

export function ContactBuilder({ form }: ContactBuilderProps) {
  const t = useTranslations('instituteSettings.info');

  // Subscribe to phones array length so primary-checkbox toggling can update
  // every sibling. We do not subscribe to per-row values here — those come
  // from the per-field render-prop below.
  const phonesLength = useStore(form.store, (state) => {
    const values = (state as { values: InstituteInfoFormValues }).values;
    return values.contact.phones.length;
  });

  function handlePrimaryChange(selectedIndex: number) {
    for (let i = 0; i < phonesLength; i += 1) {
      form.setFieldValue(`contact.phones[${i}].isPrimary`, i === selectedIndex);
    }
  }

  return (
    <div className="space-y-8">
      {/* Phone Numbers */}
      <FieldSet>
        <FieldLabel>{t('phones')}</FieldLabel>
        <form.Field name="contact.phones" mode="array">
          {(arrayField: AnyFieldApi) => {
            const phones = arrayField.state.value as ReadonlyArray<unknown>;
            const arrayErrors = fieldErrorMessages(arrayField);
            return (
              <>
                {arrayErrors.length > 0 && <FieldError errors={arrayErrors} />}
                <div className="space-y-3">
                  {phones.map((_, index) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: array order is the only stable identity for these rows.
                      key={index}
                      className="grid grid-cols-[80px_1fr_auto_auto_1fr_auto] items-end gap-2 rounded-lg border p-3"
                    >
                      <form.AppField name={`contact.phones[${index}].countryCode`}>
                        {(field: AnyFieldApi) => {
                          const value =
                            typeof field.state.value === 'string' ? field.state.value : '';
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
                                aria-label={t('countryCode')}
                              />
                            </Field>
                          );
                        }}
                      </form.AppField>

                      <form.AppField name={`contact.phones[${index}].number`}>
                        {(field: AnyFieldApi) => {
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
                                id={index === 0 ? 'contact-phone' : field.name}
                                name={field.name}
                                value={value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                data-testid={`contact-phone-${index}`}
                                placeholder={t('phonePlaceholder')}
                                inputMode="numeric"
                                maxLength={10}
                                aria-invalid={invalid || undefined}
                              />
                              {invalid && <FieldError errors={errors} />}
                            </Field>
                          );
                        }}
                      </form.AppField>

                      <form.AppField name={`contact.phones[${index}].isPrimary`}>
                        {(field: AnyFieldApi) => {
                          const checked = field.state.value === true;
                          return (
                            <Field>
                              <FieldLabel className="text-xs">{t('isPrimary')}</FieldLabel>
                              <div className="flex h-8 items-center">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => handlePrimaryChange(index)}
                                  aria-label={t('isPrimary')}
                                />
                              </div>
                            </Field>
                          );
                        }}
                      </form.AppField>

                      <form.AppField name={`contact.phones[${index}].isWhatsappEnabled`}>
                        {(field: AnyFieldApi) => {
                          const checked = field.state.value === true;
                          return (
                            <Field>
                              <FieldLabel className="text-xs">{t('isWhatsappEnabled')}</FieldLabel>
                              <div className="flex h-8 items-center">
                                <Switch
                                  aria-label={t('isWhatsappEnabled')}
                                  checked={checked}
                                  onCheckedChange={(v) => field.handleChange(v === true)}
                                />
                              </div>
                            </Field>
                          );
                        }}
                      </form.AppField>

                      <form.AppField name={`contact.phones[${index}].label`}>
                        {(field: AnyFieldApi) => {
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
                        disabled={phones.length <= 1}
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
                >
                  <Plus className="size-4" />
                  {t('addPhone')}
                </Button>
              </>
            );
          }}
        </form.Field>
      </FieldSet>

      {/* Email Addresses */}
      <FieldSet>
        <FieldLabel>{t('emails')}</FieldLabel>
        <form.Field name="contact.emails" mode="array">
          {(arrayField: AnyFieldApi) => {
            const emails = arrayField.state.value as ReadonlyArray<unknown>;
            return (
              <>
                <div className="space-y-3">
                  {emails.map((_, index) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: array order is the only stable identity for these rows.
                      key={index}
                      className="grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2 rounded-lg border p-3"
                    >
                      <form.AppField name={`contact.emails[${index}].address`}>
                        {(field: AnyFieldApi) => {
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
                                id={index === 0 ? 'contact-email' : field.name}
                                name={field.name}
                                value={value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                data-testid={`contact-email-${index}`}
                                type="email"
                                placeholder={t('emailPlaceholder')}
                                aria-invalid={invalid || undefined}
                              />
                              {invalid && <FieldError errors={errors} />}
                            </Field>
                          );
                        }}
                      </form.AppField>

                      <form.AppField name={`contact.emails[${index}].isPrimary`}>
                        {(field: AnyFieldApi) => {
                          const checked = field.state.value === true;
                          return (
                            <Field>
                              <FieldLabel className="text-xs">{t('emailIsPrimary')}</FieldLabel>
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
                        {(field: AnyFieldApi) => {
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
                  onClick={() => arrayField.pushValue({ address: '', isPrimary: false, label: '' })}
                >
                  <Plus className="size-4" />
                  {t('addEmail')}
                </Button>
              </>
            );
          }}
        </form.Field>
      </FieldSet>
    </div>
  );
}
