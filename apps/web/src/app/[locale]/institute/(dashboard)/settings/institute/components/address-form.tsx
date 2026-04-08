'use client';

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
} from '@roviq/ui';
import { Check, ChevronsUpDown, Info, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import type { InstituteInfoFormValues } from '../schemas';

/**
 * Indian states/UTs. Kept in code (not `messages/*.json`) because these are
 * proper nouns whose English spelling is canonical across locales. Display
 * labels are still translated via `instituteSettings.info.states.indian`
 * when available.
 */
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

type IndianState = (typeof INDIAN_STATES)[number];

/** Shape of one PIN lookup result from api.postalpincode.in. */
interface PostOffice {
  Name: string;
  District: string;
  State: string;
  Country: string;
}

interface PincodeApiResponse {
  Status: 'Success' | 'Error' | '404';
  Message: string;
  PostOffice: PostOffice[] | null;
}

interface PincodeLookupResult {
  city: string;
  district: string;
  state: string;
}

/**
 * Look up an Indian 6-digit PIN code via api.postalpincode.in.
 * Returns null if not found or on network failure — caller decides UX.
 */
async function lookupPincode(
  pin: string,
  signal: AbortSignal,
): Promise<PincodeLookupResult | null> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
      signal,
      // Public, anonymous endpoint — no credentials.
      credentials: 'omit',
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as PincodeApiResponse[];
    const first = payload[0];
    if (!first || first.Status !== 'Success' || !first.PostOffice?.length) {
      return null;
    }
    const office = first.PostOffice[0];
    if (!office) return null;
    return {
      city: office.Name,
      district: office.District,
      state: office.State,
    };
  } catch {
    return null;
  }
}

/** Normalise an API state name to a value present in `INDIAN_STATES`. */
function matchIndianState(apiState: string): IndianState | null {
  const normalised = apiState.trim().toLowerCase();
  return INDIAN_STATES.find((s) => s.toLowerCase() === normalised) ?? null;
}

export interface AddressFormProps {
  /**
   * Optional whitelist of states to show in the dropdown. Supplied by the
   * parent when a state-specific board is selected (e.g. RBSE → Rajasthan).
   * See rule [HBCFO]. Defaults to all Indian states/UTs.
   */
  allowedStates?: readonly IndianState[];
}

export function AddressForm({ allowedStates }: AddressFormProps) {
  const t = useTranslations('instituteSettings.info');
  const {
    register,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useFormContext<InstituteInfoFormValues>();

  const currentState = watch('address.state');
  const currentCity = watch('address.city');
  const currentDistrict = watch('address.district');
  const line1 = watch('address.line1');
  const line2 = watch('address.line2');
  const line3 = watch('address.line3');
  const postalCode = watch('address.postal_code');

  const [statePopoverOpen, setStatePopoverOpen] = React.useState(false);
  const [isLookingUpPin, setIsLookingUpPin] = React.useState(false);
  const [pinLookupError, setPinLookupError] = React.useState<string | null>(null);
  const lookupAbortRef = React.useRef<AbortController | null>(null);

  const visibleStates = React.useMemo<readonly IndianState[]>(
    () => allowedStates ?? INDIAN_STATES,
    [allowedStates],
  );

  // Ensure the currently-selected state is still valid when the allowed
  // list narrows (e.g. user switches board). Reset if not.
  React.useEffect(() => {
    if (!currentState) return;
    const stillAllowed = visibleStates.some((s) => s === currentState);
    if (!stillAllowed) {
      setValue('address.state', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [currentState, visibleStates, setValue]);

  async function handlePincodeBlur(e: React.FocusEvent<HTMLInputElement>) {
    const value = e.target.value.trim();
    // Validate shape via RHF first.
    await trigger('address.postal_code');
    if (!/^\d{6}$/.test(value)) return;

    // Cancel in-flight lookup.
    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;

    setIsLookingUpPin(true);
    setPinLookupError(null);
    const result = await lookupPincode(value, controller.signal);
    if (controller.signal.aborted) return;
    setIsLookingUpPin(false);

    if (!result) {
      setPinLookupError(t('pinLookupNotFound'));
      return;
    }

    // Only auto-fill empty fields — never overwrite user input.
    if (!currentCity) {
      setValue('address.city', result.city, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (!currentDistrict) {
      setValue('address.district', result.district, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    if (!currentState) {
      const matched = matchIndianState(result.state);
      if (matched && visibleStates.includes(matched)) {
        setValue('address.state', matched, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }

  // Abort any in-flight PIN lookup on unmount to avoid state updates on
  // unmounted components.
  React.useEffect(() => {
    return () => {
      lookupAbortRef.current?.abort();
    };
  }, []);

  // Formatted address preview (see [HBCFO]).
  const previewLines = [
    line1,
    line2,
    line3,
    [currentCity, currentDistrict].filter(Boolean).join(', '),
    [currentState, postalCode].filter(Boolean).join(' - '),
    'India',
  ].filter((l) => l && l.trim().length > 0);

  const { ref: postalRef, onBlur: rhfPostalBlur, ...postalRest } = register('address.postal_code');

  return (
    <FieldSet className="space-y-6">
      <FieldGroup>
        <Field data-invalid={!!errors.address?.line1}>
          <FieldLabel htmlFor="address-line1">{t('line1')}</FieldLabel>
          <Input
            id="address-line1"
            {...register('address.line1')}
            placeholder={t('line1Placeholder')}
            aria-invalid={!!errors.address?.line1}
            autoComplete="address-line1"
          />
          <FieldDescription>{t('line1Description')}</FieldDescription>
          {errors.address?.line1 && <FieldError errors={[errors.address.line1]} />}
        </Field>

        <Field>
          <FieldLabel htmlFor="address-line2">{t('line2')}</FieldLabel>
          <Input
            id="address-line2"
            {...register('address.line2')}
            placeholder={t('line2Placeholder')}
            autoComplete="address-line2"
          />
          <FieldDescription>{t('line2Description')}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="address-line3">{t('line3')}</FieldLabel>
          <Input
            id="address-line3"
            {...register('address.line3')}
            placeholder={t('line3Placeholder')}
            autoComplete="address-line3"
          />
          <FieldDescription>{t('line3Description')}</FieldDescription>
        </Field>

        <div className="grid grid-cols-1 gap-4 @md/field-group:grid-cols-2">
          <Field data-invalid={!!errors.address?.postal_code}>
            <FieldLabel htmlFor="address-postal-code">
              {t('postalCode')}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ms-1 size-5"
                    aria-label={t('postalCodeHelpAria')}
                  >
                    <Info className="size-3.5" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" className="max-w-xs text-sm">
                  {t('postalCodeHelp')}
                </PopoverContent>
              </Popover>
            </FieldLabel>
            <Input
              id="address-postal-code"
              {...postalRest}
              ref={postalRef}
              onBlur={async (e) => {
                rhfPostalBlur(e);
                await handlePincodeBlur(e);
              }}
              placeholder={t('postalCodePlaceholder')}
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="postal-code"
              aria-invalid={!!errors.address?.postal_code}
              aria-busy={isLookingUpPin}
              aria-describedby="address-postal-code-desc"
            />
            <FieldDescription id="address-postal-code-desc">
              {isLookingUpPin ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3" aria-hidden="true" />
                  {t('pinLookupLoading')}
                </span>
              ) : (
                t('postalCodeDescription')
              )}
            </FieldDescription>
            {errors.address?.postal_code && <FieldError errors={[errors.address.postal_code]} />}
            {pinLookupError && !errors.address?.postal_code && (
              <FieldDescription className="text-amber-600 dark:text-amber-500">
                {pinLookupError}
              </FieldDescription>
            )}
          </Field>

          <Field data-invalid={!!errors.address?.state}>
            <FieldLabel htmlFor="address-state">
              {allowedStates ? t('stateFiltered', { count: visibleStates.length }) : t('state')}
            </FieldLabel>
            <Popover open={statePopoverOpen} onOpenChange={setStatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="address-state"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={statePopoverOpen}
                  aria-invalid={!!errors.address?.state}
                  aria-label={t('state')}
                  className="w-full justify-between font-normal"
                >
                  <span className={currentState ? '' : 'text-muted-foreground'}>
                    {currentState || t('statePlaceholder')}
                  </span>
                  <ChevronsUpDown className="ms-2 size-4 shrink-0 opacity-50" aria-hidden="true" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0">
                <Command>
                  <CommandInput placeholder={t('stateSearchPlaceholder')} />
                  <CommandList>
                    <CommandEmpty>{t('stateEmpty')}</CommandEmpty>
                    <CommandGroup>
                      {visibleStates.map((state) => (
                        <CommandItem
                          key={state}
                          value={state}
                          onSelect={(selected) => {
                            setValue('address.state', selected, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                            setStatePopoverOpen(false);
                          }}
                        >
                          <Check
                            className={`me-2 size-4 ${
                              currentState === state ? 'opacity-100' : 'opacity-0'
                            }`}
                            aria-hidden="true"
                          />
                          {state}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FieldDescription>{t('stateDescription')}</FieldDescription>
            {errors.address?.state && <FieldError errors={[errors.address.state]} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 @md/field-group:grid-cols-2">
          <Field data-invalid={!!errors.address?.city}>
            <FieldLabel htmlFor="address-city">{t('city')}</FieldLabel>
            <Input
              id="address-city"
              {...register('address.city')}
              placeholder={t('cityPlaceholder')}
              autoComplete="address-level2"
              aria-invalid={!!errors.address?.city}
            />
            <FieldDescription>{t('cityDescription')}</FieldDescription>
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
            <FieldDescription>{t('districtDescription')}</FieldDescription>
            {errors.address?.district && <FieldError errors={[errors.address.district]} />}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 @md/field-group:grid-cols-2">
          <Field data-invalid={!!errors.address?.coordinates?.lat}>
            <FieldLabel htmlFor="address-lat">
              {t('latitude')}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ms-1 size-5"
                    aria-label={t('coordinatesHelpAria')}
                  >
                    <Info className="size-3.5" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" className="max-w-xs text-sm">
                  {t('coordinatesHelp')}
                </PopoverContent>
              </Popover>
            </FieldLabel>
            <Input
              id="address-lat"
              {...register('address.coordinates.lat', { valueAsNumber: true })}
              type="number"
              step="any"
              min={-90}
              max={90}
              placeholder={t('latitudePlaceholder')}
              aria-invalid={!!errors.address?.coordinates?.lat}
            />
            <FieldDescription>{t('latitudeDescription')}</FieldDescription>
            {errors.address?.coordinates?.lat && (
              <FieldError errors={[errors.address.coordinates.lat]} />
            )}
          </Field>

          <Field data-invalid={!!errors.address?.coordinates?.lng}>
            <FieldLabel htmlFor="address-lng">{t('longitude')}</FieldLabel>
            <Input
              id="address-lng"
              {...register('address.coordinates.lng', { valueAsNumber: true })}
              type="number"
              step="any"
              min={-180}
              max={180}
              placeholder={t('longitudePlaceholder')}
              aria-invalid={!!errors.address?.coordinates?.lng}
            />
            <FieldDescription>{t('longitudeDescription')}</FieldDescription>
            {errors.address?.coordinates?.lng && (
              <FieldError errors={[errors.address.coordinates.lng]} />
            )}
          </Field>
        </div>
      </FieldGroup>

      {previewLines.length > 0 && (
        <div
          className="rounded-md border border-dashed border-border bg-muted/30 p-4"
          aria-live="polite"
        >
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <MapPin className="size-3.5" aria-hidden="true" />
            {t('addressPreview')}
          </div>
          <address className="text-sm not-italic leading-relaxed">
            {previewLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </address>
        </div>
      )}
    </FieldSet>
  );
}
