import type { AbilityRule, AuthScope } from '@roviq/common-types';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';

export type { AuthScope };

export type I18nContent = Record<string, string>;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  scope: AuthScope;
  tenantId?: string;
  resellerId?: string;
  membershipId?: string;
  roleId?: string;
  abilityRules?: AbilityRule[];
  /**
   * Symbolic NAV_SLUGS resolved server-side from the active membership's
   * `role.primaryNavSlugs`. Frontend resolves these through its `navRegistry`
   * to render the phone bottom tab bar. Empty → fall back to per-portal
   * `defaultSlugs` configured in the layout.
   */
  primaryNavSlugs?: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface MembershipInfo {
  membershipId: string;
  tenantId: string;
  roleId: string;
  instituteName: I18nContent;
  instituteSlug: string;
  instituteLogoUrl?: string;
  roleName: I18nContent;
}

export interface LoginResult {
  accessToken?: string;
  refreshToken?: string;
  user?: AuthUser;
  requiresInstituteSelection?: boolean;
  userId?: string;
  selectionToken?: string;
  memberships?: MembershipInfo[];
}

export interface Tenant {
  id: string;
  name: I18nContent;
  slug: string;
  logoUrl?: string;
}

export interface PasskeyAuthOptions {
  optionsJSON: PublicKeyCredentialRequestOptionsJSON;
  challengeId: string;
}

export interface PasskeyInfo {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  registeredAt: string;
  lastUsedAt?: string;
}

export interface SessionInfo {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  lastUsedAt?: string;
  createdAt: string;
  isCurrent: boolean;
}
