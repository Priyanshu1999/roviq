import { ATTENDANCE_TYPE_VALUES, addressSchema } from '@roviq/common-types';
import { i18nTextSchema } from '@roviq/i18n';
import { z } from 'zod';

// --- Phone schema ---
const phoneSchema = z.object({
  country_code: z.string().default('+91'),
  number: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits.'),
  is_primary: z.boolean().default(false),
  is_whatsapp_enabled: z.boolean().default(false),
  label: z.string().max(50).default(''),
});

// --- Email schema ---
const emailSchema = z.object({
  address: z.string().email('Invalid email address.'),
  is_primary: z.boolean().default(false),
  label: z.string().max(50).default(''),
});

// --- Contact schema with cross-field validation ---
const contactSchema = z
  .object({
    phones: z.array(phoneSchema).min(1, 'At least one phone number is required.'),
    emails: z.array(emailSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const primaryCount = data.phones.filter((p) => p.is_primary).length;
    if (primaryCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one phone must be marked as primary.',
        path: ['phones'],
      });
    }
    if (primaryCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only one phone can be marked as primary.',
        path: ['phones'],
      });
    }
    if (!data.phones.some((p) => p.is_whatsapp_enabled)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one phone must be WhatsApp-enabled.',
        path: ['phones'],
      });
    }
  });

// --- Institute Info form schema ---
export const instituteInfoSchema = z.object({
  name: i18nTextSchema,
  code: z.string().max(50).optional(),
  contact: contactSchema,
  address: addressSchema,
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  version: z.number().int(),
});

export type InstituteInfoFormValues = z.infer<typeof instituteInfoSchema>;

// --- Hex color validation ---
const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex colour (e.g. #1A2B3C).')
  .optional()
  .or(z.literal(''));

// --- Branding form schema ---
export const instituteBrandingSchema = z.object({
  logoUrl: z.string().url().optional().or(z.literal('')),
  faviconUrl: z.string().url().optional().or(z.literal('')),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  themeIdentifier: z.string().optional(),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
});

export type InstituteBrandingFormValues = z.infer<typeof instituteBrandingSchema>;

// --- Shift schema ---
const shiftSchema = z.object({
  name: z.string().min(1, 'Shift name is required.'),
  start: z.string().min(1, 'Start time is required.'),
  end: z.string().min(1, 'End time is required.'),
});

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// --- Term schema ---
const termSchema = z.object({
  label: z.string().min(1, 'Term name is required.'),
  startDate: z
    .string()
    .min(1, 'Start date is required.')
    .regex(ISO_DATE_REGEX, 'Start date must be YYYY-MM-DD.'),
  endDate: z
    .string()
    .min(1, 'End date is required.')
    .regex(ISO_DATE_REGEX, 'End date must be YYYY-MM-DD.'),
});

// --- Section strength norms schema ---
const sectionStrengthNormsSchema = z.object({
  optimal: z.number().int().min(1, 'Must be at least 1.'),
  hardMax: z.number().int().min(1, 'Must be at least 1.'),
  exemptionAllowed: z.boolean().default(false),
});

// --- Config form schema ---
export const instituteConfigSchema = z.object({
  attendanceType: z.enum(ATTENDANCE_TYPE_VALUES).optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  shifts: z.array(shiftSchema).default([]),
  termStructure: z.array(termSchema).default([]),
  sectionStrengthNorms: sectionStrengthNormsSchema,
});

export type InstituteConfigFormValues = z.infer<typeof instituteConfigSchema>;
