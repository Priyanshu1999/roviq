import { Field, InputType, Int } from '@nestjs/graphql';
import { MembershipStatus } from '@roviq/common-types';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

@InputType({ description: 'Filters for the resellerListUsers query.' })
export class ResellerListUsersFilterInput {
  @Field(() => String, {
    nullable: true,
    description: 'Full-text search against user profile names and username.',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Filter by institute — only shows users with memberships in this specific institute.',
  })
  @IsUUID()
  @IsOptional()
  instituteId?: string;

  @Field(() => [MembershipStatus], {
    nullable: true,
    description: "Filter by membership status within the reseller's institutes.",
  })
  @IsArray()
  @IsEnum(MembershipStatus, { each: true })
  @IsOptional()
  membershipStatus?: MembershipStatus[];

  @Field(() => Int, {
    nullable: true,
    defaultValue: 20,
    description: 'Number of records to return (1–100). Default 20.',
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  first?: number;

  @Field(() => String, { nullable: true, description: 'Relay cursor for forward pagination.' })
  @IsString()
  @IsOptional()
  after?: string;
}
