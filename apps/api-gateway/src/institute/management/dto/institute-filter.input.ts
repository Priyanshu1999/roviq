import { Field, InputType, Int } from '@nestjs/graphql';
import { InstituteStatus, InstituteType } from '@roviq/common-types';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

@InputType({ description: 'Filter and pagination input for listing institutes within a reseller.' })
export class InstituteFilterInput {
  @Field({ nullable: true, description: 'Full-text search over institute name and code.' })
  @IsString()
  @IsOptional()
  search?: string;

  @Field(() => InstituteStatus, {
    nullable: true,
    description: 'Filter by institute lifecycle status.',
  })
  @IsEnum(InstituteStatus)
  @IsOptional()
  status?: InstituteStatus;

  @Field(() => InstituteType, {
    nullable: true,
    description: 'Filter by institution type (school, coaching, library).',
  })
  @IsEnum(InstituteType)
  @IsOptional()
  type?: InstituteType;

  @Field(() => Int, {
    nullable: true,
    defaultValue: 20,
    description: 'Number of records to return (1–100).',
  })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  first?: number;

  @Field({ nullable: true, description: 'Relay-style cursor for forward pagination.' })
  @IsString()
  @IsOptional()
  after?: string;
}
