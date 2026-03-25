import { Field, InputType } from '@nestjs/graphql';
import { AuditMask } from '@roviq/audit';
import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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
  @Field({ nullable: true, description: 'Class at time of first admission' })
  admissionClass?: string;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: 'Admission type: new, rte, lateral_entry, re_admission, transfer',
  })
  admissionType?: string;

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
  @IsString()
  @Field({ nullable: true })
  academicStatus?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  socialCategory?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  stream?: string;

  @AuditMask()
  @IsOptional()
  @Field(() => String, {
    nullable: true,
    description: 'Medical info JSONB — redacted in audit logs',
  })
  medicalInfo?: string;
}
