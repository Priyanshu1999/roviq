/**
 * Auth-domain enums — user, membership, and role lifecycle states.
 *
 * Single source of truth consumed by:
 *   - `libs/database` → `pgEnum(...)` column types
 *   - `apps/api-gateway` → `registerEnumType(...)` + `@IsEnum(...)`
 *   - `apps/web` → Zod schemas, Select options
 */

// ─── UserStatus ─────────────────────────────────────────────────────────────

export const USER_STATUS_VALUES = [
  // User can log in and access all permitted features
  'ACTIVE',
  // Temporarily blocked by a platform admin — cannot log in, data preserved
  'SUSPENDED',
  // Auto-locked after too many failed login attempts — requires admin unlock
  'LOCKED',
] as const;

export type UserStatus = (typeof USER_STATUS_VALUES)[number];
export const UserStatus = Object.fromEntries(USER_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in UserStatus]: K;
};

// ─── MembershipStatus ───────────────────────────────────────────────────────

export const MEMBERSHIP_STATUS_VALUES = [
  // User is an active member of the institute and can exercise their role's abilities
  'ACTIVE',
  // Membership temporarily frozen by institute admin — user cannot access this institute
  'SUSPENDED',
  // Membership permanently removed — user loses all access and abilities in this institute
  'REVOKED',
] as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS_VALUES)[number];
export const MembershipStatus = Object.fromEntries(MEMBERSHIP_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in MembershipStatus]: K;
};

// ─── RoleStatus ─────────────────────────────────────────────────────────────

export const ROLE_STATUS_VALUES = [
  // Role can be assigned to members and its abilities are enforced by CASL
  'ACTIVE',
  // Role is disabled — cannot be assigned to new members, existing holders lose its abilities
  'INACTIVE',
] as const;

export type RoleStatus = (typeof ROLE_STATUS_VALUES)[number];
export const RoleStatus = Object.fromEntries(ROLE_STATUS_VALUES.map((v) => [v, v])) as {
  readonly [K in RoleStatus]: K;
};
