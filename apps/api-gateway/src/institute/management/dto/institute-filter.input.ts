import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InstituteStatusEnum, InstituteTypeEnum } from '../models/institute.model';

@InputType()
export class InstituteFilterInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  search?: string;

  @Field(() => InstituteStatusEnum, { nullable: true })
  @IsEnum(InstituteStatusEnum)
  @IsOptional()
  status?: InstituteStatusEnum;

  @Field(() => InstituteTypeEnum, { nullable: true })
  @IsEnum(InstituteTypeEnum)
  @IsOptional()
  type?: InstituteTypeEnum;

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
