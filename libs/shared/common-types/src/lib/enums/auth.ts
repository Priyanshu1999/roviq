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

// ─── AuthScope ──────────────────────────────────────────────────────────────
// Three-scope auth model — determines which RLS context, DB role, JWT TTL,
// guard, and module group a request uses. Casing is intentionally lowercase
// to match the JWT `scope` claim and the audit_logs `scope` column already
// in production.

export const AUTH_SCOPE_VALUES = [
  // Roviq super-admin / platform ops — manages the SaaS itself across all tenants
  'platform',
  // Reseller staff — manages institutes onboarded under their reseller
  'reseller',
  // Institute (tenant) member — operates inside a single institute's data
  'institute',
] as const;

export type AuthScope = (typeof AUTH_SCOPE_VALUES)[number];
export const AuthScope = Object.fromEntries(AUTH_SCOPE_VALUES.map((v) => [v, v])) as {
  readonly [K in AuthScope]: K;
};

// ─── AuthSecurityEventType ──────────────────────────────────────────────────
// Events emitted on the `NOTIFICATION.auth.security` subject. Consumed by
// notification-service to decide which Novu workflow to trigger and by the
// user's recent-activity feed.

export const AUTH_SECURITY_EVENT_TYPE_VALUES = [
  // Successful sign-in — surfaces in the user's "recent activity" feed
  'LOGIN',
  // User completed the password-reset flow
  'PASSWORD_RESET',
  // Sign-in from a device fingerprint not seen before for this user
  'NEW_DEVICE',
  // Auto-lock after the configured number of failed attempts
  'ACCOUNT_LOCKED',
  // Active session revoked by the user, an admin, or impersonation cleanup
  'SESSION_REVOKED',
  // OTP delivered to the impersonation target for consent confirmation
  'IMPERSONATION_OTP',
] as const;

export type AuthSecurityEventType = (typeof AUTH_SECURITY_EVENT_TYPE_VALUES)[number];
export const AuthSecurityEventType = Object.fromEntries(
  AUTH_SECURITY_EVENT_TYPE_VALUES.map((v) => [v, v]),
) as { readonly [K in AuthSecurityEventType]: K };
