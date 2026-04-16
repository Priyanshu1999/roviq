import { Field, ID, InputType } from '@nestjs/graphql';
import { EnquirySource, EnquiryStatus } from '@roviq/common-types';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

@InputType({
  description:
    'Fields that can be updated on an existing admission enquiry. All fields are optional.',
})
export class UpdateEnquiryInput {
  @Field({ nullable: true, description: 'Name of the prospective student.' })
  @IsOptional()
  @IsString()
  studentName?: string;

  @Field({
    nullable: true,
    description: 'Requested class or grade, e.g. "Nursery", "LKG", "Class 5".',
  })
  @IsOptional()
  @IsString()
  classRequested?: string;

  @Field({
    nullable: true,
    description: 'Name of the parent or guardian who submitted the enquiry.',
  })
  @IsOptional()
  @IsString()
  parentName?: string;

  @Field({ nullable: true, description: '10-digit Indian mobile number (without +91 prefix).' })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'parentPhone must be a 10-digit Indian mobile starting with 6-9',
  })
  parentPhone?: string;

  @Field({ nullable: true, description: 'Parent contact email address.' })
  @IsOptional()
  @IsString()
  parentEmail?: string;

  @Field(() => EnquiryStatus, { nullable: true, description: 'Lifecycle status of this enquiry.' })
  @IsOptional()
  @IsEnum(EnquiryStatus)
  status?: EnquiryStatus;

  @Field({ nullable: true, description: 'Scheduled follow-up date (ISO date YYYY-MM-DD).' })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Staff member responsible for following up on this enquiry.',
  })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @Field({ nullable: true, description: 'Internal notes for the admissions team.' })
  @IsOptional()
  @IsString()
  notes?: string;

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

  @Field({
    nullable: true,
    description: 'Whether the prospective student has a sibling already enrolled.',
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

  @Field({ nullable: true, description: 'Any special educational needs or disabilities to note.' })
  @IsOptional()
  @IsString()
  specialNeeds?: string;
}
