import { Field, InputType, Int } from '@nestjs/graphql';
import { InstituteStatus, InstituteType } from '@roviq/common-types';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType()
export class InstituteFilterInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  search?: string;

  @Field(() => InstituteStatus, { nullable: true })
  @IsEnum(InstituteStatus)
  @IsOptional()
  status?: InstituteStatus;

  @Field(() => InstituteType, { nullable: true })
  @IsEnum(InstituteType)
  @IsOptional()
  type?: InstituteType;

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
