import { Field, InputType, Int } from '@nestjs/graphql';
import { GroupType } from '@roviq/common-types';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { GroupStatusEnum } from '../models/institute-group.model';

@InputType()
export class InstituteGroupFilterInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  search?: string;

  @Field(() => GroupStatusEnum, { nullable: true })
  @IsEnum(GroupStatusEnum)
  @IsOptional()
  status?: GroupStatusEnum;

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
