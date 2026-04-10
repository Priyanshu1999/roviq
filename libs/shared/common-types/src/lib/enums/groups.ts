/**
 * Shared enum constants for the groups domain — membership mechanics and
 * functional categorisation of institute groups.
 *
 * Note: `GroupType`, `GroupStatus`, and `DynamicGroupStatus` already live in
 * `./institute-group` and are NOT redeclared here.
 *
 * Declared here in `@roviq/common-types` so every layer reads from a single
 * source of truth WITHOUT api-gateway having to depend on `@roviq/database`:
 *
 *   - `libs/database/src/schema/groups/enums.ts` imports the `*_VALUES`
 *     tuples and passes them to `pgEnum(...)`, keeping Postgres enums and
 *     TypeScript unions in sync automatically.
 *
 *   - `apps/api-gateway/src/institute/groups/` resolvers import the const
 *     aliases for NestJS `registerEnumType` / `@Field(...)` / `@IsEnum(...)`.
 *
 *   - Frontend pages under `apps/web/src/app/[locale]/institute/(dashboard)/
 *     groups/` import the tuples for Select options and the const aliases for
 *     Zod schemas.
 *
 * Per the Roviq enum documentation rule every option has an inline comment
 * explaining its domain meaning.
 */

/**
 * How group membership is determined — controls which membership management
 * UI and rule-evaluation pipeline applies to a given group. Consumed by:
 *
 *   - `groups.membership_type` Postgres pgEnum (libs/database schema)
 *   - api-gateway `GroupMembershipType` GraphQL enum and group DTOs
 *   - Frontend group-builder wizard step that asks "how should members be
 *     added?" before surfacing manual-list vs. rule-editor panels
 */
export const GROUP_MEMBERSHIP_TYPE_VALUES = [
  // Members are added and removed exclusively by manual staff action
  'STATIC',
  // Members are evaluated and synced automatically based on defined rules
  'DYNAMIC',
  // A base set of manual members plus an optional rule-evaluated overlay
  'HYBRID',
] as const;

/** String-literal union derived from the tuple above. */
export type GroupMembershipType = (typeof GROUP_MEMBERSHIP_TYPE_VALUES)[number];

/**
 * Const object whose keys map to themselves — the runtime value needed by
 * NestJS `registerEnumType`, `@Field(() => GroupMembershipType)`,
 * class-validator `@IsEnum(GroupMembershipType)`, and Zod 4's
 * `z.enum(GROUP_MEMBERSHIP_TYPE_VALUES)`. Shares the identifier with the
 * type above because TypeScript types and values live in separate namespaces.
 */
export const GroupMembershipType = Object.fromEntries(
  GROUP_MEMBERSHIP_TYPE_VALUES.map((v) => [v, v]),
) as { readonly [K in GroupMembershipType]: K };

// ---------------------------------------------------------------------------

/**
 * How an individual member was added to a group — stored on each membership
 * row for audit trail and UI differentiation. Consumed by:
 *
 *   - `group_members.source` Postgres pgEnum (libs/database schema)
 *   - api-gateway membership resolver (add-member mutation sets `MANUAL`;
 *     rule-engine sets `RULE`; group-inheritance sets `INHERITED`)
 *   - Frontend group-members table "Source" column badge colouring
 */
export const GROUP_MEMBER_SOURCE_VALUES = [
  // A staff member explicitly added this individual to the group
  'MANUAL',
  // Membership was evaluated and created by the dynamic rule engine
  'RULE',
  // Membership was propagated from a parent / composite group
  'INHERITED',
] as const;

/** String-literal union derived from the tuple above. */
export type GroupMemberSource = (typeof GROUP_MEMBER_SOURCE_VALUES)[number];

/**
 * Const object whose keys map to themselves — runtime value for NestJS
 * `registerEnumType`, `@IsEnum(GroupMemberSource)`, and Zod `z.enum(...)`.
 * Shares the identifier with the type because TypeScript types and values
 * live in separate namespaces.
 */
export const GroupMemberSource = Object.fromEntries(
  GROUP_MEMBER_SOURCE_VALUES.map((v) => [v, v]),
) as { readonly [K in GroupMemberSource]: K };

// ---------------------------------------------------------------------------

/**
 * The functional category of a group — describes WHAT the group represents
 * in the institute's domain model, independent of how membership is managed.
 *
 * Distinct from `GroupType` (in `./institute-group`), which describes the
 * ownership / scoping level of the group record (e.g., INSTITUTE vs.
 * RESELLER vs. PLATFORM). `DomainGroupType` is the semantic "kind" used for
 * feature routing, permission rules, and UI rendering decisions.
 *
 * Consumed by:
 *   - `groups.domain_type` Postgres pgEnum (libs/database schema)
 *   - api-gateway `DomainGroupType` GraphQL enum — resolvers switch on this
 *     to load type-specific metadata (timetable for CLASS, route stops for
 *     BUS_ROUTE, etc.)
 *   - Frontend group list filtering, icon selection, and detail-page routing
 */
export const DOMAIN_GROUP_TYPE_VALUES = [
  // Academic class / grade — e.g., "Class 10", "Grade 5"
  'CLASS',
  // Division within a class — e.g., "10-A", "5-Blue"
  'SECTION',
  // Inter-class house for co-curricular competition — e.g., "Red House"
  'HOUSE',
  // Student interest club — e.g., "Robotics Club", "Debate Society"
  'CLUB',
  // Sports team competing in inter-school or intra-school tournaments
  'SPORTS_TEAM',
  // Students sharing a bus route — used for transport management and alerts
  'BUS_ROUTE',
  // Elective or compulsory subject group — e.g., "Physics (Science Stream)"
  'SUBJECT',
  // Academic stream at senior secondary level — e.g., "Science", "Commerce"
  'STREAM',
  // Students sharing a fee structure, concession, or payment plan
  'FEE',
  // Students appearing in a specific exam batch or assessment group
  'EXAM',
  // Notification-distribution group — push/SMS/email routing target
  'NOTIFICATION',
  // Co-curricular or extra-curricular activity cohort
  'ACTIVITY',
  // Administrative department — e.g., "Science Faculty", "Accounts"
  'DEPARTMENT',
  // Formal institute committee — e.g., "PTA", "Discipline Committee"
  'COMMITTEE',
  // A group composed of multiple other groups (superset / union group)
  'COMPOSITE',
  // A custom, free-form group that does not fit any predefined category
  'CUSTOM',
] as const;

/** String-literal union derived from the tuple above. */
export type DomainGroupType = (typeof DOMAIN_GROUP_TYPE_VALUES)[number];

/**
 * Const object whose keys map to themselves — runtime value for NestJS
 * `registerEnumType`, `@IsEnum(DomainGroupType)`, and Zod `z.enum(...)`.
 * Shares the identifier with the type because TypeScript types and values
 * live in separate namespaces.
 */
export const DomainGroupType = Object.fromEntries(DOMAIN_GROUP_TYPE_VALUES.map((v) => [v, v])) as {
  readonly [K in DomainGroupType]: K;
};
