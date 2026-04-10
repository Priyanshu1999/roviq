/**
 * Institute Group Type — single source of truth.
 *
 * Consumed by:
 *   - `libs/database` → `pgEnum('GroupType', GROUP_TYPE_VALUES)`
 *   - `apps/api-gateway` → `registerEnumType(GroupType)` + `@IsEnum(GroupType)`
 *   - `apps/web` → Select options, Zod schemas
 */
export const GROUP_TYPE_VALUES = [
  // Charitable trust operating one or more institutes under a single trust deed
  'TRUST',
  // Registered society (Societies Registration Act) managing institutes collectively
  'SOCIETY',
  // Corporate chain — centrally managed institutes sharing branding and operations
  'CHAIN',
  // Franchise model — independently operated institutes licensed under a parent brand
  'FRANCHISE',
] as const;

/** String-literal union derived from the tuple above. */
export type GroupType = (typeof GROUP_TYPE_VALUES)[number];

/**
 * Const object whose keys map to themselves — the runtime value needed by
 * NestJS `registerEnumType`, `@Field(() => GroupType)`,
 * class-validator `@IsEnum(GroupType)`, and Zod 4's `z.enum(GroupType)`.
 */
export const GroupType = Object.fromEntries(GROUP_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in GroupType]: K;
};

/**
 * Institute Group Status — lifecycle state of an institute group.
 *
 * Single source of truth for:
 *   - the `GroupStatus` Postgres pgEnum (libs/database enums.ts)
 *   - NestJS GraphQL enum + class-validator @IsEnum
 *   - frontend Zod schemas + Select options
 */
export const GROUP_STATUS_VALUES = [
  // Institute group is operational — member institutes can share resources and reports
  'ACTIVE',
  // Group voluntarily deactivated — member institutes continue independently
  'INACTIVE',
  // Group forcibly blocked by platform admin — all group-level operations frozen
  'SUSPENDED',
] as const;

export type GroupStatus = (typeof GROUP_STATUS_VALUES)[number];

export const GroupStatus = Object.fromEntries(GROUP_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in GroupStatus]: K;
};

/**
 * Dynamic group (Groups Engine) lifecycle state — controls whether the group
 * is operational, disabled, or permanently archived.
 *
 * Distinct from `GroupStatus` which is for institute groups (franchises, trusts, chains).
 *
 * Single source of truth for:
 *   - the `DynamicGroupStatus` Postgres pgEnum (libs/database groups/groups.ts)
 *   - NestJS GraphQL enum + class-validator @IsEnum
 *   - frontend Zod schemas + Select options
 */
export const DYNAMIC_GROUP_STATUS_VALUES = [
  // Group is operational — members resolved and visible
  'ACTIVE',
  // Group disabled — members preserved but not used for notifications/fees/etc.
  'INACTIVE',
  // Read-only historical group — cannot be reactivated
  'ARCHIVED',
] as const;

export type DynamicGroupStatus = (typeof DYNAMIC_GROUP_STATUS_VALUES)[number];

export const DynamicGroupStatus = Object.fromEntries(
  DYNAMIC_GROUP_STATUS_VALUES.map((v) => [v, v]),
) as { readonly [K in DynamicGroupStatus]: K };
