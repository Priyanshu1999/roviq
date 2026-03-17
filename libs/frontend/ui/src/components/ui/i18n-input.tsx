'use client';

import { localeLabels, locales } from '@roviq/i18n';
import { cn } from '@roviq/ui/lib/utils';
import { type FieldValues, type Path, useFormContext } from 'react-hook-form';
import { FieldError } from './field';
import { Input } from './input';

interface I18nInputProps<T extends FieldValues> {
  name: Path<T>;
  label: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Multi-locale text input for i18n JSONB fields.
 * Renders one input per supported locale, with the default locale required.
 *
 * Must be used inside a `<FormProvider>`.
 */
export function I18nInput<T extends FieldValues>({
  name,
  label,
  required,
  placeholder,
  className,
}: I18nInputProps<T>) {
  const {
    register,
    formState: { errors },
  } = useFormContext<T>();

  const fieldErrors = errors[name] as Record<string, { message?: string }> | undefined;

  return (
    <fieldset className={cn('space-y-1', className)}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-1 space-y-2">
        {locales.map((locale) => {
          const fieldPath = `${name}.${locale}` as Path<T>;
          const error = fieldErrors?.[locale];
          return (
            <div key={locale}>
              <div className="flex items-center gap-2">
                <span className="w-8 text-xs text-muted-foreground">{locale.toUpperCase()}</span>
                <Input
                  {...register(fieldPath, {
                    required: locale === 'en' && required ? 'Required' : false,
                  })}
                  placeholder={placeholder ?? localeLabels[locale]}
                  aria-invalid={!!error}
                />
              </div>
              {error?.message && <FieldError errors={[error]} />}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
