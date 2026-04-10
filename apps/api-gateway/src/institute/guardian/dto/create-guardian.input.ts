import { Field, ID, InputType } from '@nestjs/graphql';
import { Gender, GuardianEducationLevel, GuardianRelationship } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

// Validator `message:` strings below are hardcoded English pending
// backend i18n (ROV-222). Once that lands, swap each to
// `i18nValidationMessage('validation.guardian.*')`.

@InputType({ description: 'Input for creating a guardian.' })
export class CreateGuardianInput {
  @Field(() => I18nTextScalar, {
    description:
      'Guardian first name as an i18nText map. The default locale (`en`) is required; additional locales are optional.',
  })
  @IsObject()
  firstName!: I18nContent;

  @Field(() => I18nTextScalar, {
    nullable: true,
    description: 'Guardian last name as an i18nText map. Omit entirely for single-name cultures.',
  })
  @IsObject()
  @IsOptional()
  lastName?: I18nContent;

  @Field(() => Gender, { nullable: true })
  @IsOptional()
  @IsEnum(Gender, { message: 'gender must be one of: MALE, FEMALE, OTHER' })
  gender?: Gender;

  @Field(() => String, {
    nullable: true,
    description: '10-digit Indian mobile number (without +91 prefix).',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  phone?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Contact email address. Must be RFC-5322 valid when provided.',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Guardian occupation (free text, e.g. "Engineer", "Shopkeeper").',
  })
  @IsOptional()
  @IsString()
  occupation?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Employer / organisation the guardian works at (free text).',
  })
  @IsOptional()
  @IsString()
  organization?: string;

  @Field(() => GuardianEducationLevel, {
    nullable: true,
    description:
      "Guardian's highest completed education level. Constrained enum — mirrors the chk_education_level DB constraint.",
  })
  @IsOptional()
  @IsEnum(GuardianEducationLevel, {
    message: `educationLevel must be one of: ${Object.values(GuardianEducationLevel).join(', ')}`,
  })
  educationLevel?: GuardianEducationLevel;

  @Field(() => ID, {
    nullable: true,
    description:
      'Optional student_profiles.id — when provided the guardian is created AND immediately linked to that student.',
  })
  @IsOptional()
  @IsUUID()
  studentProfileId?: string;

  @Field(() => GuardianRelationship, {
    nullable: true,
    description:
      'Relationship of the guardian to the student. Required when `studentProfileId` is supplied.',
  })
  @IsOptional()
  @IsEnum(GuardianRelationship, {
    message: `relationship must be one of: ${Object.values(GuardianRelationship).join(', ')}`,
  })
  relationship?: GuardianRelationship;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description:
      'When linking to a student, mark this guardian as the primary contact. Exactly one primary per student is enforced by the service.',
  })
  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;
}
