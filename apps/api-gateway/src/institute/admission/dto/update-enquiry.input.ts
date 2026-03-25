import { Field, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

@InputType({ description: 'Input for updating an enquiry (ROV-159)' })
export class UpdateEnquiryInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  studentName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  classRequested?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  parentName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  parentPhone?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  parentEmail?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  source?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  referredBy?: string;

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
}
