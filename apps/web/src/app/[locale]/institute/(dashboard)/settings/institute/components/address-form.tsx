'use client';

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@roviq/ui';
import { useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import type { InstituteInfoFormValues } from '../schemas';

/** Indian states/UTs for the state dropdown. */
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

export function AddressForm() {
  const t = useTranslations('instituteSettings.info');
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<InstituteInfoFormValues>();

  const currentState = watch('address.state');

  return (
    <FieldGroup>
      <Field data-invalid={!!errors.address?.line1}>
        <FieldLabel htmlFor="address-line1">{t('line1')}</FieldLabel>
        <Input
          id="address-line1"
          {...register('address.line1')}
          placeholder={t('line1Placeholder')}
          aria-invalid={!!errors.address?.line1}
        />
        {errors.address?.line1 && <FieldError errors={[errors.address.line1]} />}
      </Field>

      <Field>
        <FieldLabel htmlFor="address-line2">{t('line2')}</FieldLabel>
        <Input
          id="address-line2"
          {...register('address.line2')}
          placeholder={t('line2Placeholder')}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="address-line3">{t('line3')}</FieldLabel>
        <Input
          id="address-line3"
          {...register('address.line3')}
          placeholder={t('line3Placeholder')}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={!!errors.address?.city}>
          <FieldLabel htmlFor="address-city">{t('city')}</FieldLabel>
          <Input
            id="address-city"
            {...register('address.city')}
            placeholder={t('cityPlaceholder')}
            aria-invalid={!!errors.address?.city}
          />
          {errors.address?.city && <FieldError errors={[errors.address.city]} />}
        </Field>

        <Field data-invalid={!!errors.address?.district}>
          <FieldLabel htmlFor="address-district">{t('district')}</FieldLabel>
          <Input
            id="address-district"
            {...register('address.district')}
            placeholder={t('districtPlaceholder')}
            aria-invalid={!!errors.address?.district}
          />
          {errors.address?.district && <FieldError errors={[errors.address.district]} />}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={!!errors.address?.state}>
          <FieldLabel>{t('state')}</FieldLabel>
          <Select
            value={currentState}
            onValueChange={(v) => setValue('address.state', v, { shouldDirty: true })}
          >
            <SelectTrigger aria-invalid={!!errors.address?.state}>
              <SelectValue placeholder={t('statePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {INDIAN_STATES.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.address?.state && <FieldError errors={[errors.address.state]} />}
        </Field>

        <Field data-invalid={!!errors.address?.postal_code}>
          <FieldLabel htmlFor="address-postal-code">{t('postalCode')}</FieldLabel>
          <Input
            id="address-postal-code"
            {...register('address.postal_code')}
            placeholder={t('postalCodePlaceholder')}
            inputMode="numeric"
            maxLength={6}
            aria-invalid={!!errors.address?.postal_code}
          />
          {errors.address?.postal_code && <FieldError errors={[errors.address.postal_code]} />}
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor="address-lat">{t('latitude')}</FieldLabel>
          <Input
            id="address-lat"
            {...register('address.coordinates.lat', { valueAsNumber: true })}
            type="number"
            step="any"
            placeholder={t('latitudePlaceholder')}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="address-lng">{t('longitude')}</FieldLabel>
          <Input
            id="address-lng"
            {...register('address.coordinates.lng', { valueAsNumber: true })}
            type="number"
            step="any"
            placeholder={t('longitudePlaceholder')}
          />
        </Field>
      </div>
    </FieldGroup>
  );
}
