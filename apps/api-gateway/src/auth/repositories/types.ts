import type { I18nContent, memberships, users } from '@roviq/database';

type UserStatus = (typeof users.$inferSelect)['status'];
type MembershipStatus = (typeof memberships.$inferSelect)['status'];

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
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

export interface CreateRefreshTokenData {
  id: string;
  tokenHash: string;
  userId: string;
  tenantId: string;
  membershipId?: string;
  expiresAt: Date;
}

export interface RefreshTokenWithRelations {
  id: string;
  tokenHash: string;
  userId: string;
  revokedAt: Date | null;
  expiresAt: Date;
  user: UserRecord;
  membership: {
    id: string;
    tenantId: string;
    roleId: string;
    abilities: unknown;
    role: Pick<RoleInfo, 'id' | 'abilities'>;
  } | null;
}
