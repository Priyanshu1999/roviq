import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { createConnectionType } from '../../../common/pagination/relay-pagination.model';

/** GraphQL enum mirroring the database `UserStatus` pgEnum */
export enum UserStatusEnum {
  /** User can log in and access all permitted features */
  ACTIVE = 'ACTIVE',
  /** Temporarily blocked by a platform admin — cannot log in, data preserved */
  SUSPENDED = 'SUSPENDED',
  /** Auto-locked after too many failed login attempts — requires admin unlock */
  LOCKED = 'LOCKED',
}

registerEnumType(UserStatusEnum, { name: 'UserStatus' });

/** GraphQL enum mirroring the database `MembershipStatus` pgEnum */
export enum MembershipStatusEnum {
  /** User is an active member of the institute and can exercise their role's abilities */
  ACTIVE = 'ACTIVE',
  /** Membership temporarily frozen by institute admin — user cannot access this institute */
  SUSPENDED = 'SUSPENDED',
  /** Membership permanently removed — user loses all access and abilities in this institute */
  REVOKED = 'REVOKED',
}

registerEnumType(MembershipStatusEnum, { name: 'MembershipStatus' });

@ObjectType({ description: 'User profile snapshot returned in admin user listings' })
export class AdminUserProfileModel {
  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar)
  firstName!: I18nContent;

  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar, { nullable: true })
  lastName?: I18nContent | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;
}

@ObjectType({
  description: 'Membership record showing which institute a user belongs to and in what role',
})
export class AdminUserMembershipModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  tenantId!: string;

  @Field(() => ID)
  roleId!: string;

  @Field(() => MembershipStatusEnum)
  status!: MembershipStatusEnum;

  /** Denormalized institute name for display — avoids N+1 in listings */
  @Field(() => String, { nullable: true })
  instituteName?: string | null;
}

@ObjectType({ description: 'Admin view of a user with profile and membership details' })
export class AdminUserModel {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  username!: string;

  @Field(() => UserStatusEnum)
  status!: UserStatusEnum;

  @Field()
  createdAt!: Date;

  @Field(() => AdminUserProfileModel, { nullable: true })
  profile?: AdminUserProfileModel | null;

  @Field(() => [AdminUserMembershipModel])
  memberships!: AdminUserMembershipModel[];
}

export const { ConnectionType: AdminUserConnection, EdgeType: AdminUserEdge } =
  createConnectionType(AdminUserModel, 'AdminUser');
