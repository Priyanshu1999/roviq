import { z } from 'zod';

/**
 * Shared address schema for Indian institute addresses.
 *
 * Why this lives in `@roviq/common-types`:
 *   The same address shape is used by multiple create/edit forms across the
 *   admin and institute portals. Inlining a copy in each page diverges over
 *   time and duplicates the lat/lng NaN-preprocess workaround described below.
 *
 * Field shape (snake_case) matches the GraphQL input contract already used
 * by the institute service — do NOT rename to camelCase without a coordinated
 * backend change.
 *
 * The lat/lng preprocess is load-bearing:
 *   `AddressForm` registers the numeric coordinate inputs with
 *   `register(..., { valueAsNumber: true })`. React Hook Form converts an
 *   empty `<input type="number">` into `NaN`. Without the preprocess, Zod
 *   reports the raw "expected number, received NaN" error and it leaks into
 *   `<FieldError>`. Preprocessing `NaN` back to `undefined` lets the
 *   `.optional()` on the inner schema accept a blank field cleanly.
 */

/** Indian 6-digit PIN code regex, used by every consumer form today. */
export const INDIAN_PIN_CODE_REGEX = /^[0-9]{6}$/;

/**
 * Collapse `NaN` (produced by RHF `valueAsNumber` on empty inputs) back to
 * `undefined` so the downstream `.optional()` treats it as "not provided"
 * rather than a parse failure.
 */
const nanToUndefined = (v: unknown): unknown =>
  typeof v === 'number' && Number.isNaN(v) ? undefined : v;

/** Latitude: -90..90, optional, NaN-safe. */
export const latitudeSchema = z.preprocess(nanToUndefined, z.number().min(-90).max(90).optional());

/** Longitude: -180..180, optional, NaN-safe. */
export const longitudeSchema = z.preprocess(
  nanToUndefined,
  z.number().min(-180).max(180).optional(),
);

/** Optional coordinate pair. The whole object is optional; individual fields
 *  accept empty-as-NaN from RHF via the preprocess above. */
export const coordinatesSchema = z
  .object({
    lat: latitudeSchema,
    lng: longitudeSchema,
  })
  .optional();

/**
 * Error messages for the strict address schema. All are optional — English
 * defaults are provided. Consumers using `next-intl` should pass `t(...)`
 * values so Zod errors flow through the app's i18n pipeline.
 */
export interface AddressSchemaMessages {
  line1Required?: string;
  cityRequired?: string;
  districtRequired?: string;
  stateRequired?: string;
  postalCodeInvalid?: string;
}

const DEFAULT_MESSAGES: Required<AddressSchemaMessages> = {
  line1Required: 'Address line 1 is required.',
  cityRequired: 'City is required.',
  districtRequired: 'District is required.',
  stateRequired: 'State is required.',
  postalCodeInvalid: 'PIN code must be exactly 6 digits.',
};

/**
 * Build a strict address schema where the core fields
 * (line1, city, district, state, postal_code) are required.
 *
 * Use this for forms where the address is mandatory
 * (institute create, institute settings).
 */
export function createAddressSchema(messages: AddressSchemaMessages = {}) {
  const m = { ...DEFAULT_MESSAGES, ...messages };
  return z.object({
    line1: z.string().min(1, m.line1Required),
    line2: z.string().optional().default(''),
    line3: z.string().optional().default(''),
    city: z.string().min(1, m.cityRequired),
    district: z.string().min(1, m.districtRequired),
    state: z.string().min(1, m.stateRequired),
    postal_code: z.string().regex(INDIAN_PIN_CODE_REGEX, m.postalCodeInvalid),
    country: z.string().default('IN'),
    coordinates: coordinatesSchema,
  });
}

/**
 * Address schema where every field is optional and string fields default to
 * empty. Use this when the entire address block is optional at the form
 * level (e.g. institute group create — address may be omitted entirely).
 *
 * Consumers must still guard submission (`values.address.line1 ? ... : undefined`)
 * because this schema intentionally does not enforce "all-or-nothing".
 */
export const optionalAddressSchema = z.object({
  line1: z.string().default(''),
  line2: z.string().optional().default(''),
  line3: z.string().optional().default(''),
  city: z.string().default(''),
  district: z.string().default(''),
  state: z.string().default(''),
  postal_code: z.string().default(''),
  country: z.string().default('IN'),
  coordinates: coordinatesSchema,
});

/** Default strict address schema with English error messages. */
export const addressSchema = createAddressSchema();

/** Strict address value type (line1/city/district/state/postal_code required). */
export type AddressValues = z.infer<typeof addressSchema>;

/** Optional address value type (all fields optional). */
export type OptionalAddressValues = z.infer<typeof optionalAddressSchema>;
