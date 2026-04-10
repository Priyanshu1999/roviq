/**
 * Reseller tier — controls what a reseller can do with its institutes.
 *
 * Single source of truth for:
 *   - the `ResellerTier` Postgres pgEnum
 *   - the NestJS GraphQL enum
 *   - class-validator @IsEnum targets on DTOs
 *   - frontend Zod schemas + Select options
 *
 * Values are UPPER_SNAKE per Roviq convention.
 */
export const RESELLER_TIER_VALUES = [
  // Full control — reseller can manage institutes, billing, and configurations end-to-end
  'FULL_MANAGEMENT',
  // Support-only access — reseller can assist institutes but cannot modify billing or config
  'SUPPORT_MANAGEMENT',
  // View-only access — reseller can see institute data and reports but cannot make changes
  'READ_ONLY',
] as const;

export type ResellerTier = (typeof RESELLER_TIER_VALUES)[number];

export const ResellerTier = Object.fromEntries(RESELLER_TIER_VALUES.map((v) => [v, v])) as {
  readonly [K in ResellerTier]: K;
};

/**
 * Reseller status — lifecycle state of a reseller account.
 *
 * Single source of truth for:
 *   - the `ResellerStatus` Postgres pgEnum
 *   - the NestJS GraphQL enum
 *   - class-validator @IsEnum targets on DTOs
 *   - frontend Zod schemas + Select options
 */
export const RESELLER_STATUS_VALUES = [
  // Reseller is operational and can manage their assigned institutes
  'ACTIVE',
  // Reseller access frozen by platform admin — their institutes remain accessible directly
  'SUSPENDED',
  // Reseller permanently removed — institutes reassigned to platform or another reseller
  'DELETED',
] as const;

export type ResellerStatus = (typeof RESELLER_STATUS_VALUES)[number];

export const ResellerStatus = Object.fromEntries(RESELLER_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in ResellerStatus]: K;
};
