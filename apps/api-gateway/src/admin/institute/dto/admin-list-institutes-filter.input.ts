import { Field, InputType, Int } from '@nestjs/graphql';
import { InstituteStatus, InstituteType } from '@roviq/common-types';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

@InputType()
export class AdminListInstitutesFilterInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  search?: string;

  @Field(() => [InstituteStatus], { nullable: true })
  @IsArray()
  @IsEnum(InstituteStatus, { each: true })
  @IsOptional()
  status?: InstituteStatus[];

  @Field(() => InstituteType, { nullable: true })
  @IsEnum(InstituteType)
  @IsOptional()
  type?: InstituteType;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  resellerId?: string;

  @Field({ nullable: true })
  @IsUUID()
  @IsOptional()
  groupId?: string;

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
