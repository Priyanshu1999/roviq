import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType({ description: 'Filters for the resellerListTeamMembers query' })
export class ResellerTeamFilterInput {
  @Field({ nullable: true, description: 'Search against username, first name, or last name' })
  @IsString()
  @IsOptional()
  search?: string;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  first?: number;

  @Field({ nullable: true, description: 'Relay-cursor for forward pagination' })
  @IsString()
  @IsOptional()
  after?: string;
}
