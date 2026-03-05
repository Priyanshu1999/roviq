import type { AbilityRule } from '@roviq/common-types';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  tenantId: string;
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
  tenantId: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
}
