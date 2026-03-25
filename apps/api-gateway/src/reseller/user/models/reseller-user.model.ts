import { Field, ID, ObjectType } from '@nestjs/graphql';
import { MembershipStatusEnum, UserStatusEnum } from '../../../admin/user/models/admin-user.model';
import { createConnectionType } from '../../../common/pagination/relay-pagination.model';

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

  @Field(() => MembershipStatusEnum)
  status!: MembershipStatusEnum;

  /** Denormalized institute name for display */
  @Field(() => String, { nullable: true })
  instituteName?: string | null;
}

@ObjectType({ description: 'User profile snapshot returned in reseller user listings' })
export class ResellerUserProfileModel {
  @Field()
  firstName!: string;

  @Field({ nullable: true })
  lastName?: string | null;

  @Field({ nullable: true, description: 'Full name in regional script' })
  nameLocal?: string | null;

  @Field({ nullable: true })
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

  @Field()
  createdAt!: Date;

  @Field(() => ResellerUserProfileModel, { nullable: true })
  profile?: ResellerUserProfileModel | null;

  @Field(() => [ResellerUserMembershipModel])
  memberships!: ResellerUserMembershipModel[];
}

export const { ConnectionType: ResellerUserConnection, EdgeType: ResellerUserEdge } =
  createConnectionType(ResellerUserModel, 'ResellerUser');
