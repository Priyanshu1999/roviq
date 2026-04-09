import { Field, InputType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// Validator `message:` strings below are hardcoded English pending
// backend i18n (ROV-222). Once that lands, swap each to
// `i18nValidationMessage('validation.staff.*')`.
//
// Every property carries a class-validator decorator because the global
// ValidationPipe runs with `forbidNonWhitelisted: true` — undecorated
// properties are rejected at runtime as "property should not exist".

@InputType({ description: 'Input for creating a new staff member' })
export class CreateStaffInput {
  @Field(() => I18nTextScalar, { description: 'First name of the staff member' })
  @IsObject()
  firstName!: I18nContent;

  @Field(() => I18nTextScalar, { nullable: true })
  @IsOptional()
  @IsObject()
  lastName?: I18nContent;

  @Field(() => String, { nullable: true, description: 'Gender: male/female/other' })
  @IsOptional()
  @IsIn(['male', 'female', 'other'], {
    message: 'gender must be one of: male, female, other',
  })
  gender?: string;

  @Field(() => String, { nullable: true, description: 'Date of birth (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'dateOfBirth must be a valid ISO 8601 date string' })
  dateOfBirth?: string;

  @Field(() => String, { nullable: true, description: 'Email address' })
  @IsOptional()
  @IsEmail({}, { message: 'email must be a valid email address' })
  email?: string;

  @Field(() => String, { nullable: true, description: '10-digit Indian mobile number' })
  @IsOptional()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'phone must be a 10-digit Indian mobile starting with 6-9',
  })
  phone?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Job title (e.g., PGT Physics, TGT Mathematics)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  designation?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Department (e.g., Science, Commerce, Administration)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @Field(() => String, { nullable: true, description: 'Date of joining (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'dateOfJoining must be a valid ISO 8601 date string' })
  dateOfJoining?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Employment type: regular/contractual/part_time/guest/volunteer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employmentType?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Subject specialization (coaching-specific)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialization?: string;
}
