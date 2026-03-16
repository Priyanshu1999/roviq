import type { AbilityRule } from '@roviq/common-types';

export type I18nContent = Record<string, string>;

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  tenantId?: string;
  roleId?: string;
  abilityRules?: AbilityRule[];
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
  platformToken?: string;
  memberships?: MembershipInfo[];
}

export interface Tenant {
  id: string;
  name: I18nContent;
  slug: string;
  logoUrl?: string;
}

export interface PasskeyAuthOptions {
  optionsJSON: Record<string, unknown>;
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
