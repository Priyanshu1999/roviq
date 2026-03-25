import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

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

  @Field()
  groupType!: string;

  @Field()
  membershipType!: string;

  @Field(() => [String])
  memberTypes!: string[];

  @Field()
  isSystem!: boolean;

  @Field()
  status!: string;

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
  @Field()
  groupId!: string;

  @Field(() => Int)
  memberCount!: number;

  @Field(() => Date, { nullable: true })
  resolvedAt?: Date | null;
}
