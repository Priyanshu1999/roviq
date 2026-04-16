import { Field, ID, InputType } from '@nestjs/graphql';
import { EnquirySource, Gender, GuardianRelationship } from '@roviq/common-types';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

@InputType({ description: 'Input for creating a pre-admission enquiry.' })
export class CreateEnquiryInput {
  @Field({ description: 'Full name of the prospective student.' })
  @IsString()
  @IsNotEmpty()
  studentName!: string;

  @Field({
    nullable: true,
    description: 'Date of birth of the prospective student (ISO date YYYY-MM-DD).',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @Field(() => Gender, { nullable: true, description: 'Gender of the prospective student.' })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Field({ description: 'Requested class or grade, e.g. "Nursery", "LKG", "Class 5".' })
  @IsString()
  @IsNotEmpty()
  classRequested!: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Academic year the admission is being sought for.',
  })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @Field({ description: 'Full name of the parent or guardian submitting the enquiry.' })
  @IsString()
  @IsNotEmpty()
  parentName!: string;

  @Field({ description: '10-digit Indian mobile number (without +91 prefix).' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  parentPhone!: string;

  @Field({ nullable: true, description: 'Parent contact email address.' })
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @Field(() => GuardianRelationship, {
    nullable: true,
    description: 'Relationship of the contact person to the student.',
  })
  @IsOptional()
  @IsEnum(GuardianRelationship)
  parentRelation?: GuardianRelationship;

  @Field(() => EnquirySource, {
    nullable: true,
    description: 'Channel through which this enquiry was received.',
  })
  @IsOptional()
  @IsEnum(EnquirySource)
  source?: EnquirySource;

  @Field({
    nullable: true,
    description: 'Name of the person or campaign who referred the enquiry.',
  })
  @IsOptional()
  @IsString()
  referredBy?: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Staff member assigned to follow up on this enquiry.',
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @Field({ nullable: true, description: "Name of the student's current or previous institute." })
  @IsOptional()
  @IsString()
  previousSchool?: string;

  @Field({
    nullable: true,
    description: 'Board of the student\'s previous institute, e.g. "CBSE".',
  })
  @IsOptional()
  @IsString()
  previousBoard?: string;

  @Field({
    nullable: true,
    description: 'Whether the student has a sibling already enrolled in this institute.',
  })
  @IsOptional()
  @IsBoolean()
  siblingInSchool?: boolean;

  @Field({
    nullable: true,
    description: 'Admission number of the enrolled sibling (if siblingInSchool is true).',
  })
  @IsOptional()
  @IsString()
  siblingAdmissionNo?: string;

  @Field({
    nullable: true,
    description: 'Any special educational needs or disabilities to note for the admissions team.',
  })
  @IsOptional()
  @IsString()
  specialNeeds?: string;

  @Field({ nullable: true, description: 'Additional internal notes for the admissions team.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true, description: 'Scheduled follow-up date (ISO date YYYY-MM-DD).' })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
