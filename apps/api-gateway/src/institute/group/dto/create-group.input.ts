import { Field, ID, InputType } from '@nestjs/graphql';
import { DomainGroupType, DynamicGroupStatus, GroupMembershipType } from '@roviq/common-types';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType({
  description:
    'Input for creating a student/staff group for messaging, permissions, or reporting (ROV-163).',
})
export class CreateGroupInput {
  @Field({
    description: 'Human-readable group name, e.g. "Science Stream Class 11" or "Fee Defaulters".',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({ nullable: true, description: "Optional description of the group's purpose." })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => DomainGroupType, { description: 'Domain category this group belongs to.' })
  @IsEnum(DomainGroupType)
  groupType!: DomainGroupType;

  @Field(() => GroupMembershipType, {
    nullable: true,
    defaultValue: GroupMembershipType.DYNAMIC,
    description:
      'Whether membership is dynamic (rule-based), static (manually managed), or hybrid.',
  })
  @IsOptional()
  @IsEnum(GroupMembershipType)
  membershipType?: GroupMembershipType;

  @Field(() => [String], {
    nullable: true,
    defaultValue: ['student'],
    description: 'Member entity types this group can contain, e.g. ["student"] or ["staff"].',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberTypes?: string[];

  @Field({
    nullable: true,
    description:
      'Whether this is a system-managed group that cannot be deleted by institute admins.',
  })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @Field(() => ID, { nullable: true, description: 'Parent group ID for nested group hierarchies.' })
  @IsOptional()
  @IsUUID()
  parentGroupId?: string;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description:
      'JsonLogic rule object used to compute dynamic membership. Required when membershipType is DYNAMIC or HYBRID.',
  })
  @IsOptional()
  @IsObject()
  rule?: Record<string, unknown>;

  @Field({
    nullable: true,
    description:
      'Human-readable explanation of the JsonLogic rule, e.g. "Students in Class 11 Science with fees overdue > 30 days".',
  })
  @IsOptional()
  @IsString()
  ruleDescription?: string;

  @Field(() => [ID], {
    nullable: true,
    description:
      'Child group IDs for composite groups. Used when membershipType is STATIC and groups are nested.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  childGroupIds?: string[];
}

@InputType({
  description: 'Fields that can be updated on an existing group. All fields are optional.',
})
export class UpdateGroupInput {
  @Field({ nullable: true, description: 'Human-readable group name.' })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true, description: "Optional description of the group's purpose." })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => DynamicGroupStatus, {
    nullable: true,
    description: 'Lifecycle status of the group.',
  })
  @IsOptional()
  @IsEnum(DynamicGroupStatus)
  status?: DynamicGroupStatus;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Updated JsonLogic rule object for dynamic membership.',
  })
  @IsOptional()
  @IsObject()
  rule?: Record<string, unknown>;

  @Field({ nullable: true, description: 'Human-readable explanation of the updated rule.' })
  @IsOptional()
  @IsString()
  ruleDescription?: string;
}

@InputType({ description: 'Filter for listing groups.' })
export class GroupFilterInput {
  @Field(() => DomainGroupType, { nullable: true, description: 'Filter by group domain category.' })
  @IsOptional()
  @IsEnum(DomainGroupType)
  groupType?: DomainGroupType;

  @Field(() => GroupMembershipType, {
    nullable: true,
    description: 'Filter by membership management type.',
  })
  @IsOptional()
  @IsEnum(GroupMembershipType)
  membershipType?: GroupMembershipType;

  @Field(() => DynamicGroupStatus, {
    nullable: true,
    description: 'Filter by group lifecycle status.',
  })
  @IsOptional()
  @IsEnum(DynamicGroupStatus)
  status?: DynamicGroupStatus;

  @Field({ nullable: true, description: 'Full-text search over group name and description.' })
  @IsOptional()
  @IsString()
  search?: string;
}
