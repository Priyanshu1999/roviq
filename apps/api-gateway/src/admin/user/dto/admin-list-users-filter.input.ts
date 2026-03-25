import { Field, InputType, Int } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserStatusEnum } from '../models/admin-user.model';

@InputType({ description: 'Filters for the adminListUsers query' })
export class AdminListUsersFilterInput {
  /** Full-text search against user profile names, username, and phone number */
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  search?: string;

  /** Filter by user account status */
  @Field(() => [UserStatusEnum], { nullable: true })
  @IsArray()
  @IsEnum(UserStatusEnum, { each: true })
  @IsOptional()
  status?: UserStatusEnum[];

  /** Filter to only users who have at least one institute membership */
  @Field({ nullable: true, description: 'If true, only users with institute memberships' })
  @IsOptional()
  hasInstituteMembership?: boolean;

  /** Number of records to return (Relay-style forward pagination) */
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  first?: number;

  /** Cursor for forward pagination */
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  after?: string;
}
