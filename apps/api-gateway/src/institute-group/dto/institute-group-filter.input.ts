import { Field, InputType, Int } from '@nestjs/graphql';
import { GroupStatus, GroupType } from '@roviq/common-types';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType({ description: 'Filters for listing institute groups (trusts, chains, societies).' })
export class InstituteGroupFilterInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  search?: string;

  @Field(() => GroupStatus, { nullable: true })
  @IsEnum(GroupStatus)
  @IsOptional()
  status?: GroupStatus;

  @Field(() => GroupType, { nullable: true })
  @IsEnum(GroupType)
  @IsOptional()
  type?: GroupType;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  first?: number;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  after?: string;
}
