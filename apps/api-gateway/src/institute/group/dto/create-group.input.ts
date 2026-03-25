import { Field, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType({ description: 'Input for creating a group (ROV-163)' })
export class CreateGroupInput {
  @Field()
  @IsString()
  name!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ description: 'Group type: class, section, house, club, composite, custom, etc.' })
  @IsString()
  groupType!: string;

  @Field({ nullable: true, defaultValue: 'dynamic' })
  @IsOptional()
  @IsString()
  membershipType?: string;

  @Field(() => [String], { nullable: true, defaultValue: ['student'] })
  @IsOptional()
  memberTypes?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  parentGroupId?: string;

  /** JsonLogic rule for dynamic/hybrid groups */
  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  rule?: Record<string, unknown>;

  /** Human-readable description of the rule */
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  ruleDescription?: string;

  /** Child group IDs for composite groups */
  @Field(() => [ID], { nullable: true })
  @IsOptional()
  childGroupIds?: string[];
}

@InputType({ description: 'Input for updating a group (ROV-163)' })
export class UpdateGroupInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsOptional()
  rule?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  ruleDescription?: string;
}

@InputType({ description: 'Filter for listGroups (ROV-163)' })
export class GroupFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  groupType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  membershipType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;
}
