import { Field, InputType } from '@nestjs/graphql';
import { EmploymentType } from '@roviq/common-types';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/**
 * Stub InputTypes for staff_profiles mutations (resolvers come in M2).
 * No @AuditMask needed — staff profiles contain no sensitive fields.
 */

@InputType({ description: 'Input for creating a staff profile at an institute' })
export class CreateStaffProfileInput {
  @IsUUID()
  @Field({ description: 'User ID of the staff member' })
  userId!: string;

  @IsUUID()
  @Field({ description: 'Membership ID linking user to this institute' })
  membershipId!: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @Field({ nullable: true, description: 'Institute-assigned staff/employee ID' })
  employeeId?: string;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: "Job title — e.g., 'PGT Physics', 'TGT Mathematics', 'PRT', 'Lab Assistant'",
  })
  designation?: string;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: "Department — e.g., 'Science', 'Commerce', 'Arts', 'Administration', 'Support'",
  })
  department?: string;

  @IsOptional()
  @IsDateString()
  @Field({ nullable: true, description: 'Date of joining (YYYY-MM-DD)' })
  dateOfJoining?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  @Field(() => EmploymentType, { nullable: true })
  employmentType?: EmploymentType;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: "Subject specialization — e.g., 'JEE Physics', 'NEET Biology'",
  })
  specialization?: string;
}

@InputType({ description: 'Input for updating a staff profile' })
export class UpdateStaffProfileInput {
  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: "Job title — e.g., 'PGT Physics', 'TGT Mathematics', 'PRT', 'Lab Assistant'",
  })
  designation?: string;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: "Department — e.g., 'Science', 'Commerce', 'Arts', 'Administration', 'Support'",
  })
  department?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  @Field(() => EmploymentType, { nullable: true })
  employmentType?: EmploymentType;

  @IsOptional()
  @IsBoolean()
  @Field({
    nullable: true,
    description: 'Whether this staff member is assigned as class teacher for a section',
  })
  isClassTeacher?: boolean;

  @IsOptional()
  @IsBoolean()
  @Field({
    nullable: true,
    description: 'Whether trained for Children With Special Needs instruction — UDISE+ DCF field',
  })
  trainedForCwsn?: boolean;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: "Subject specialization — e.g., 'JEE Physics', 'NEET Biology'",
  })
  specialization?: string;
}
