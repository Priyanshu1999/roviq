import { Field, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

@InputType({ description: 'Input for creating a pre-admission enquiry (ROV-159)' })
export class CreateEnquiryInput {
  @Field()
  @IsString()
  studentName!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^(male|female|other)$/, { message: 'gender must be male, female, or other' })
  gender?: string;

  @Field({ description: 'Requested class — e.g., Nursery, LKG, Class 5' })
  @IsString()
  classRequested!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @Field()
  @IsString()
  parentName!: string;

  @Field({ description: '10-digit Indian mobile (without +91)' })
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  parentPhone!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  parentEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  parentRelation?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  source?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  referredBy?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  previousSchool?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  previousBoard?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  siblingInSchool?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  siblingAdmissionNo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  specialNeeds?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
