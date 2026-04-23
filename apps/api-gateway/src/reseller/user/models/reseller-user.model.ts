import { Field, ID, ObjectType } from '@nestjs/graphql';
import { MembershipStatus } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';
import { UserStatusEnum } from '../../../admin/user/models/admin-user.model';
import { createConnectionType } from '../../../common/pagination/relay-pagination.model';

// MembershipStatus is registered via admin-user.model.ts (same object reference)

@ObjectType({
  description: 'Membership record visible to the reseller — scoped to their institutes',
})
export class ResellerUserMembershipModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  tenantId!: string;

  @Field(() => ID)
  roleId!: string;

  @Field(() => MembershipStatus)
  status!: MembershipStatus;

  /** Denormalized institute name for display */
  @Field(() => String, { nullable: true })
  instituteName?: string | null;
}

@ObjectType({ description: 'User profile snapshot returned in reseller user listings' })
export class ResellerUserProfileModel {
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
  description: 'Reseller view of a user — limited to users with memberships in their institutes',
})
export class ResellerUserModel {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field()
  username!: string;

  @Field(() => UserStatusEnum)
  status!: UserStatusEnum;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => ResellerUserProfileModel, { nullable: true })
  profile?: ResellerUserProfileModel | null;

  @Field(() => [ResellerUserMembershipModel])
  memberships!: ResellerUserMembershipModel[];
}

export const { ConnectionType: ResellerUserConnection, EdgeType: ResellerUserEdge } =
  createConnectionType(ResellerUserModel, 'ResellerUser');
