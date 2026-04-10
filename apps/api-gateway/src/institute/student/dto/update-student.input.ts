import { Field, InputType, Int } from '@nestjs/graphql';
import { AcademicStatus, Gender, MinorityType, SocialCategory } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

@InputType({
  description: 'Input for updating a student (ROV-154). Optimistic concurrency via version.',
})
export class UpdateStudentInput {
  /** Current version — required for optimistic concurrency control */
  @Field(() => Int, { description: 'Expected version for optimistic concurrency' })
  @IsInt()
  @Min(1)
  version!: number;

  // ── Personal (→ user_profiles) ──────────────────────────
  @Field(() => I18nTextScalar, { nullable: true })
  @IsObject()
  @IsOptional()
  firstName?: I18nContent;

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

  // ── Student profile fields ──────────────────────────────
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

  // ── Academic status transition ──────────────────────────
  @Field(() => AcademicStatus, {
    nullable: true,
    description: 'New academic status — validated against the state machine before persisting.',
  })
  @IsOptional()
  @IsEnum(AcademicStatus)
  academicStatus?: AcademicStatus;

  /** Required when transitioning to transferred_out */
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  tcIssued?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tcNumber?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  tcIssuedDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  tcReason?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateOfLeaving?: string;
}
