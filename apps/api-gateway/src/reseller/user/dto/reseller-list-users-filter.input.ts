import { Field, InputType, Int } from '@nestjs/graphql';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { MembershipStatusEnum } from '../../../admin/user/models/admin-user.model';

@InputType({ description: 'Filters for the resellerListUsers query' })
export class ResellerListUsersFilterInput {
  /** Full-text search against user profile names and username */
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  search?: string;

  /** Filter by institute — only shows users with memberships in this specific institute */
  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  instituteId?: string;

  /** Filter by membership status within the reseller's institutes */
  @Field(() => [MembershipStatusEnum], { nullable: true })
  @IsArray()
  @IsEnum(MembershipStatusEnum, { each: true })
  @IsOptional()
  membershipStatus?: MembershipStatusEnum[];

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
