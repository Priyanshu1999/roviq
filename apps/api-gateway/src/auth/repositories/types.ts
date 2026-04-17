import type { I18nContent, memberships, users } from '@roviq/database';

type UserStatus = (typeof users.$inferSelect)['status'];
type MembershipStatus = (typeof memberships.$inferSelect)['status'];

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  passwordChangedAt: Date | null;
  /** ROV-96 — first-login enforcement. True when an admin-created user has never rotated their temp password. */
  mustChangePassword: boolean;
}

export interface CreateUserData {
  username: string;
  email: string;
  passwordHash: string;
}

export interface InstituteInfo {
  id: string;
  name: I18nContent;
  slug: string;
  logoUrl: string | null;
}

export interface RoleInfo {
  id: string;
  name: I18nContent;
  abilities: unknown;
}

export interface MembershipWithInstituteAndRole {
  id: string;
  tenantId: string;
  roleId: string;
  status: MembershipStatus;
  abilities: unknown;
  institute: InstituteInfo;
  role: RoleInfo;
}

export interface MembershipWithRole {
  id: string;
  tenantId: string;
  roleId: string;
  status: MembershipStatus;
  abilities: unknown;
  role: Pick<RoleInfo, 'id' | 'abilities'>;
}

export interface PlatformMembershipWithRole {
  id: string;
  userId: string;
  roleId: string;
  isActive: boolean;
  abilities: unknown;
  role: Pick<RoleInfo, 'id' | 'abilities'>;
}

export interface ResellerMembershipWithResellerAndRole {
  id: string;
  userId: string;
  resellerId: string;
  roleId: string;
  isActive: boolean;
  abilities: unknown;
  reseller: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    status: string;
  };
  role: Pick<RoleInfo, 'id' | 'abilities'>;
}

export interface CreateRefreshTokenData {
  id: string;
  tokenHash: string;
  userId: string;
  tenantId: string | null;
  membershipId: string;
  membershipScope: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

export interface RefreshTokenWithRelations {
  id: string;
  tokenHash: string;
  userId: string;
  membershipScope: string;
  revokedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  deviceInfo: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: Date | null;
  user: Omit<UserRecord, 'passwordHash'>;
  membership: {
    id: string;
    tenantId: string;
    roleId: string;
    abilities: unknown;
    role: Pick<RoleInfo, 'id' | 'abilities'>;
  } | null;
}
