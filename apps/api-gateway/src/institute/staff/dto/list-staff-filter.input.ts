import { Field, InputType, Int } from '@nestjs/graphql';
import { EmploymentType } from '@roviq/common-types';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// Every property carries a class-validator decorator because the global
// ValidationPipe runs with `forbidNonWhitelisted: true` — undecorated
// properties are rejected at runtime as "property should not exist".

@InputType({ description: 'Filter for listing staff members' })
export class ListStaffFilterInput {
  @Field(() => String, { nullable: true, description: 'Filter by department' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @Field(() => String, { nullable: true, description: 'Filter by designation' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  @Field(() => EmploymentType, { nullable: true, description: 'Filter by employment type' })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @Field(() => Boolean, { nullable: true, description: 'Filter class teachers only' })
  @IsOptional()
  @IsBoolean()
  isClassTeacher?: boolean;

  @Field(() => String, { nullable: true, description: 'Search by name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  @Field(() => String, { nullable: true, description: 'Cursor for pagination' })
  @IsOptional()
  @IsString()
  after?: string;
}
