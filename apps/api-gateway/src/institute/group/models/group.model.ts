import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { DomainGroupType, DynamicGroupStatus, GroupMembershipType } from '@roviq/common-types';

registerEnumType(DynamicGroupStatus, {
  name: 'DynamicGroupStatus',
  description: 'Dynamic group (Groups Engine) lifecycle state.',
});

registerEnumType(DomainGroupType, { name: 'DomainGroupType' });
registerEnumType(GroupMembershipType, { name: 'GroupMembershipType' });

@ObjectType({ description: 'Dynamic group entity (ROV-163)' })
export class GroupModel {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => DomainGroupType)
  groupType!: DomainGroupType;

  @Field(() => GroupMembershipType)
  membershipType!: GroupMembershipType;

  @Field(() => [String])
  memberTypes!: string[];

  @Field()
  isSystem!: boolean;

  @Field(() => DynamicGroupStatus, {
    description: 'Group lifecycle state: ACTIVE, INACTIVE, or ARCHIVED.',
  })
  status!: DynamicGroupStatus;

  @Field(() => Date, { nullable: true })
  resolvedAt?: Date | null;

  @Field(() => Int)
  memberCount!: number;

  @Field(() => String, { nullable: true })
  parentGroupId?: string | null;

  @Field(() => Int)
  version!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType({ description: 'Preview result from dry-run rule evaluation' })
export class RulePreviewResult {
  @Field(() => Int)
  count!: number;

  @Field(() => [String], { description: 'Sample of up to 10 matching membership IDs' })
  sampleMembershipIds!: string[];
}

@ObjectType({ description: 'Group resolution update for subscriptions' })
export class GroupResolutionUpdate {
  @Field(() => ID)
  groupId!: string;

  @Field(() => Int)
  memberCount!: number;

  @Field(() => Date, { nullable: true })
  resolvedAt?: Date | null;
}

@ObjectType({ description: 'Group member row (membership-scoped) with exclusion flag' })
export class GroupMemberModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  groupId!: string;

  @Field(() => ID)
  membershipId!: string;

  /** 'manual' | 'rule' | 'inherited' */
  @Field()
  source!: string;

  @Field()
  isExcluded!: boolean;

  @Field(() => Date, { nullable: true })
  resolvedAt?: Date | null;

  /** Display label resolved from the underlying user (username or email). */
  @Field(() => String, { nullable: true })
  displayName?: string | null;
}
