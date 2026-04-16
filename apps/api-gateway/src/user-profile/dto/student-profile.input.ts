import { Field, InputType } from '@nestjs/graphql';
import { AuditMask } from '@roviq/audit';
import { AcademicStatus, AdmissionType, SocialCategory, StudentStream } from '@roviq/common-types';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Stub InputTypes for student_profiles mutations (resolvers come in M2).
 * @AuditMask() ensures medical_info is redacted in audit logs.
 */

@InputType({ description: 'Input for creating a student profile at an institute' })
export class CreateStudentProfileInput {
  @IsUUID()
  @Field({ description: 'User ID of the student' })
  userId!: string;

  @IsUUID()
  @Field({ description: 'Membership ID linking user to this institute' })
  membershipId!: string;

  @IsNotEmpty()
  @IsString()
  @Field({ description: 'Institute-assigned admission number' })
  admissionNumber!: string;

  @IsDateString()
  @Field({ description: 'Date of admission (YYYY-MM-DD)' })
  admissionDate!: string;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: 'Class the student was in at time of first admission (free text, e.g. "Class 1").',
  })
  admissionClass?: string;

  @IsOptional()
  @IsEnum(AdmissionType)
  @Field(() => AdmissionType, { nullable: true })
  admissionType?: AdmissionType;

  @AuditMask()
  @IsOptional()
  @Field(() => String, {
    nullable: true,
    description: 'Medical info JSONB — redacted in audit logs',
  })
  medicalInfo?: string;
}

@InputType({ description: 'Input for updating a student profile' })
export class UpdateStudentProfileInput {
  @IsOptional()
  @IsEnum(AcademicStatus)
  @Field(() => AcademicStatus, { nullable: true })
  academicStatus?: AcademicStatus;

  @IsOptional()
  @IsEnum(SocialCategory)
  @Field(() => SocialCategory, { nullable: true })
  socialCategory?: SocialCategory;

  @IsOptional()
  @IsEnum(StudentStream)
  @Field(() => StudentStream, { nullable: true })
  stream?: StudentStream;

  @AuditMask()
  @IsOptional()
  @Field(() => String, {
    nullable: true,
    description: 'Medical info JSONB — redacted in audit logs',
  })
  medicalInfo?: string;
}
