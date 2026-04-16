'use client';

import { INDIAN_STATE_VALUES, type IndianState } from '@roviq/common-types';
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
  fieldErrorMessages,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
} from '@roviq/ui';
import { type AnyFieldApi, useStore } from '@tanstack/react-form';
import { Check, ChevronsUpDown, Info, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

// The TanStack `useAppForm()` return type has many contravariant slots that
// collapse to `never` under any narrower duck-type. The kit boundary accepts
// `form: any` and trusts the consumer to pass a real `useAppForm` result.
// biome-ignore lint/suspicious/noExplicitAny: kit boundary is intentionally loose; runtime is constrained by useAppForm.
type AnyForm = any;

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

/** Normalise a human-readable API state name to an `IndianState` UPPER_SNAKE value. */
function matchIndianState(apiState: string): IndianState | null {
  const key = apiState
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/&/g, 'AND')
    .replace(/__+/g, '_')
    .replace(/_$/g, '') as IndianState;
  return INDIAN_STATE_VALUES.includes(key) ? key : null;
}

interface AddressShape {
  line1?: string;
  line2?: string;
  line3?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  coordinates?: { lat?: number; lng?: number };
}

interface AddressContainer {
  address: AddressShape;
}

export interface AddressFormProps {
  /** The form instance returned from `useAppForm()`. */
  form: AnyForm;
  /**
   * Optional whitelist of states to show in the dropdown. Supplied by the
   * parent when a state-specific board is selected (e.g. RBSE → Rajasthan).
   * See rule [HBCFO]. Defaults to all Indian states/UTs.
   */
  allowedStates?: readonly IndianState[];
}

export function AddressForm({ form, allowedStates }: AddressFormProps) {
  const t = useTranslations('instituteSettings.info');
  const tGeo = useTranslations('geography');

  // Subscribe to address values so the preview, PIN lookup, and state
  // synchronisation effects re-run when fields change.
  const address: AddressShape = useStore(form.store, (state) => {
    const values = (state as { values: AddressContainer }).values;
    return values.address ?? ({} as AddressShape);
  });
  const currentState = address.state ?? '';
  const currentCity = address.city ?? '';
  const currentDistrict = address.district ?? '';
  const line1 = address.line1 ?? '';
  const line2 = address.line2 ?? '';
  const line3 = address.line3 ?? '';
  const postalCode = address.postalCode ?? '';

  const [statePopoverOpen, setStatePopoverOpen] = React.useState(false);
  const [isLookingUpPin, setIsLookingUpPin] = React.useState(false);
  const [pinLookupError, setPinLookupError] = React.useState<string | null>(null);
  const lookupAbortRef = React.useRef<AbortController | null>(null);

  const visibleStates = React.useMemo<readonly IndianState[]>(
    () => allowedStates ?? INDIAN_STATE_VALUES,
    [allowedStates],
  );

  // Ensure the currently-selected state is still valid when the allowed
  // list narrows (e.g. user switches board). Reset if not.
  React.useEffect(() => {
    if (!currentState) return;
    const stillAllowed = visibleStates.some((s) => s === currentState);
    if (!stillAllowed) {
      form.setFieldValue('address.state', '');
    }
  }, [currentState, visibleStates, form]);

  async function handlePincodeBlur(value: string) {
    // Validate shape via the form first.
    await form.validateField('address.postalCode', 'blur');
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
      form.setFieldValue('address.city', result.city);
    }
    if (!currentDistrict) {
      form.setFieldValue('address.district', result.district);
    }
    if (!currentState) {
      const matched = matchIndianState(result.state);
      if (matched && visibleStates.includes(matched)) {
        form.setFieldValue('address.state', matched);
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

  return (
    <FieldSet className="space-y-6">
      <FieldGroup>
        <form.AppField name="address.line1">
          {(field: AnyFieldApi) => {
            const errors = fieldErrorMessages(field);
            const invalid = errors.length > 0;
            const value = typeof field.state.value === 'string' ? field.state.value : '';
            return (
              <Field data-invalid={invalid || undefined}>
                <FieldLabel htmlFor="address-line1">{t('line1')}</FieldLabel>
                <Input
                  id="address-line1"
                  data-testid="settings-address-line1-input"
                  name={field.name}
                  value={value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('line1Placeholder')}
                  aria-invalid={invalid || undefined}
                  autoComplete="address-line1"
                />
                <FieldDescription>{t('line1Description')}</FieldDescription>
                {invalid && (
                  <FieldError data-testid="settings-address-line1-error" errors={errors} />
                )}
              </Field>
            );
          }}
        </form.AppField>

        <form.AppField name="address.line2">
          {(field: AnyFieldApi) => {
            const value = typeof field.state.value === 'string' ? field.state.value : '';
            return (
              <Field>
                <FieldLabel htmlFor="address-line2">{t('line2')}</FieldLabel>
                <Input
                  id="address-line2"
                  data-testid="settings-address-line2-input"
                  name={field.name}
                  value={value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('line2Placeholder')}
                  autoComplete="address-line2"
                />
                <FieldDescription>{t('line2Description')}</FieldDescription>
              </Field>
            );
          }}
        </form.AppField>

        <form.AppField name="address.line3">
          {(field: AnyFieldApi) => {
            const value = typeof field.state.value === 'string' ? field.state.value : '';
            return (
              <Field>
                <FieldLabel htmlFor="address-line3">{t('line3')}</FieldLabel>
                <Input
                  id="address-line3"
                  data-testid="settings-address-line3-input"
                  name={field.name}
                  value={value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  placeholder={t('line3Placeholder')}
                  autoComplete="address-line3"
                />
                <FieldDescription>{t('line3Description')}</FieldDescription>
              </Field>
            );
          }}
        </form.AppField>

        <div className="grid grid-cols-1 gap-4 @md/field-group:grid-cols-2">
          <form.AppField name="address.postalCode">
            {(field: AnyFieldApi) => {
              const errors = fieldErrorMessages(field);
              const invalid = errors.length > 0;
              const value = typeof field.state.value === 'string' ? field.state.value : '';
              return (
                <Field data-invalid={invalid || undefined}>
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
                    data-testid="settings-address-postal-code-input"
                    name={field.name}
                    value={value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={async (e) => {
                      field.handleBlur();
                      await handlePincodeBlur(e.target.value.trim());
                    }}
                    placeholder={t('postalCodePlaceholder')}
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    autoComplete="postal-code"
                    aria-invalid={invalid || undefined}
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
                  {invalid && (
                    <FieldError data-testid="settings-address-postal-code-error" errors={errors} />
                  )}
                  {pinLookupError && !invalid && (
                    <FieldDescription className="text-amber-600 dark:text-amber-500">
                      {pinLookupError}
                    </FieldDescription>
                  )}
                </Field>
              );
            }}
          </form.AppField>

          <form.AppField name="address.state">
            {(field: AnyFieldApi) => {
              const errors = fieldErrorMessages(field);
              const invalid = errors.length > 0;
              const value = typeof field.state.value === 'string' ? field.state.value : '';
              return (
                <Field data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor="address-state">
                    {allowedStates
                      ? t('stateFiltered', { count: visibleStates.length })
                      : t('state')}
                  </FieldLabel>
                  <Popover open={statePopoverOpen} onOpenChange={setStatePopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="address-state"
                        data-testid="settings-address-state-trigger"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={statePopoverOpen}
                        aria-invalid={invalid || undefined}
                        aria-label={t('state')}
                        className="w-full justify-between font-normal"
                      >
                        <span className={value ? '' : 'text-muted-foreground'}>
                          {value ? tGeo(`states.${value}`) : t('statePlaceholder')}
                        </span>
                        <ChevronsUpDown
                          className="ms-2 size-4 shrink-0 opacity-50"
                          aria-hidden="true"
                        />
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
                                value={tGeo(`states.${state}`)}
                                onSelect={() => {
                                  field.handleChange(state);
                                  setStatePopoverOpen(false);
                                }}
                              >
                                <Check
                                  className={`me-2 size-4 ${
                                    value === state ? 'opacity-100' : 'opacity-0'
                                  }`}
                                  aria-hidden="true"
                                />
                                {tGeo(`states.${state}`)}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FieldDescription>{t('stateDescription')}</FieldDescription>
                  {invalid && (
                    <FieldError data-testid="settings-address-state-error" errors={errors} />
                  )}
                </Field>
              );
            }}
          </form.AppField>
        </div>

        <div className="grid grid-cols-1 gap-4 @md/field-group:grid-cols-2">
          <form.AppField name="address.city">
            {(field: AnyFieldApi) => {
              const errors = fieldErrorMessages(field);
              const invalid = errors.length > 0;
              const value = typeof field.state.value === 'string' ? field.state.value : '';
              return (
                <Field data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor="address-city">{t('city')}</FieldLabel>
                  <Input
                    id="address-city"
                    data-testid="settings-address-city-input"
                    name={field.name}
                    value={value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('cityPlaceholder')}
                    autoComplete="address-level2"
                    aria-invalid={invalid || undefined}
                  />
                  <FieldDescription>{t('cityDescription')}</FieldDescription>
                  {invalid && (
                    <FieldError data-testid="settings-address-city-error" errors={errors} />
                  )}
                </Field>
              );
            }}
          </form.AppField>

          <form.AppField name="address.district">
            {(field: AnyFieldApi) => {
              const errors = fieldErrorMessages(field);
              const invalid = errors.length > 0;
              const value = typeof field.state.value === 'string' ? field.state.value : '';
              return (
                <Field data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor="address-district">{t('district')}</FieldLabel>
                  <Input
                    id="address-district"
                    data-testid="settings-address-district-input"
                    name={field.name}
                    value={value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    placeholder={t('districtPlaceholder')}
                    aria-invalid={invalid || undefined}
                  />
                  <FieldDescription>{t('districtDescription')}</FieldDescription>
                  {invalid && (
                    <FieldError data-testid="settings-address-district-error" errors={errors} />
                  )}
                </Field>
              );
            }}
          </form.AppField>
        </div>

        <div className="grid grid-cols-1 gap-4 @md/field-group:grid-cols-2">
          <form.AppField name="address.coordinates.lat">
            {(field: AnyFieldApi) => {
              const errors = fieldErrorMessages(field);
              const invalid = errors.length > 0;
              const raw = field.state.value;
              const value = typeof raw === 'number' && !Number.isNaN(raw) ? String(raw) : '';
              return (
                <Field data-invalid={invalid || undefined}>
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
                    data-testid="settings-address-lat-input"
                    name={field.name}
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={value}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === '') {
                        field.handleChange(undefined);
                        return;
                      }
                      const parsed = Number(next);
                      field.handleChange(Number.isNaN(parsed) ? undefined : parsed);
                    }}
                    onBlur={field.handleBlur}
                    placeholder={t('latitudePlaceholder')}
                    aria-invalid={invalid || undefined}
                  />
                  <FieldDescription>{t('latitudeDescription')}</FieldDescription>
                  {invalid && (
                    <FieldError data-testid="settings-address-lat-error" errors={errors} />
                  )}
                </Field>
              );
            }}
          </form.AppField>

          <form.AppField name="address.coordinates.lng">
            {(field: AnyFieldApi) => {
              const errors = fieldErrorMessages(field);
              const invalid = errors.length > 0;
              const raw = field.state.value;
              const value = typeof raw === 'number' && !Number.isNaN(raw) ? String(raw) : '';
              return (
                <Field data-invalid={invalid || undefined}>
                  <FieldLabel htmlFor="address-lng">{t('longitude')}</FieldLabel>
                  <Input
                    id="address-lng"
                    data-testid="settings-address-lng-input"
                    name={field.name}
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={value}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === '') {
                        field.handleChange(undefined);
                        return;
                      }
                      const parsed = Number(next);
                      field.handleChange(Number.isNaN(parsed) ? undefined : parsed);
                    }}
                    onBlur={field.handleBlur}
                    placeholder={t('longitudePlaceholder')}
                    aria-invalid={invalid || undefined}
                  />
                  <FieldDescription>{t('longitudeDescription')}</FieldDescription>
                  {invalid && (
                    <FieldError data-testid="settings-address-lng-error" errors={errors} />
                  )}
                </Field>
              );
            }}
          </form.AppField>
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
