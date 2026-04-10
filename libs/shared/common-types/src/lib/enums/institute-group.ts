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
