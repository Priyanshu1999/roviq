import { Field, ID, InputType } from '@nestjs/graphql';
import { AdmissionType, Gender, MinorityType, SocialCategory } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

@InputType({ description: 'Input for creating a new student (ROV-154)' })
export class CreateStudentInput {
  // ── Personal (→ user_profiles) ──────────────────────────
  @Field(() => I18nTextScalar)
  @IsObject()
  firstName!: I18nContent;

  @Field(() => I18nTextScalar, { nullable: true })
  @IsObject()
  @IsOptional()
  lastName?: I18nContent;

  @Field(() => Gender, { nullable: true })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  religion?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^(A|B|AB|O)[+-]$/, { message: 'Invalid blood group' })
  bloodGroup?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  motherTongue?: string;

  // ── Phone (optional) ────────────────────────────────────
  @Field({ nullable: true, description: '10-digit Indian mobile number (without +91)' })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  phone?: string;

  // ── Admission (→ student_profiles) ──────────────────────
  @Field(() => ID, { description: 'Standard (grade) for initial enrollment' })
  @IsUUID()
  standardId!: string;

  @Field(() => ID, { description: 'Section for initial enrollment' })
  @IsUUID()
  sectionId!: string;

  @Field(() => ID, { description: 'Academic year for enrollment' })
  @IsUUID()
  academicYearId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  admissionDate?: string;

  @Field(() => AdmissionType, { nullable: true })
  @IsOptional()
  @IsEnum(AdmissionType)
  admissionType?: AdmissionType;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  admissionClass?: string;

  // ── Regulatory ──────────────────────────────────────────
  @Field(() => SocialCategory, { nullable: true })
  @IsOptional()
  @IsEnum(SocialCategory)
  socialCategory?: SocialCategory;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  caste?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isMinority?: boolean;

  @Field(() => MinorityType, { nullable: true })
  @IsOptional()
  @IsEnum(MinorityType)
  minorityType?: MinorityType;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isBpl?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isCwsn?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  cwsnType?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isRteAdmitted?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  rteCertificate?: string;

  // ── Previous school ─────────────────────────────────────
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  previousSchoolName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  previousSchoolBoard?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  previousSchoolUdise?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  incomingTcNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  incomingTcDate?: string;
}
