import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

@InputType({ description: 'Filter + pagination for listEnquiries (ROV-159)' })
export class EnquiryFilterInput {
  @Field(() => Int, { nullable: true, defaultValue: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  source?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  classRequested?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @Field({ nullable: true, description: 'Show overdue follow-ups (follow_up_date < today)' })
  @IsOptional()
  overdueOnly?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  followUpFrom?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  followUpTo?: string;

  @Field({ nullable: true, description: 'Full-text search on student_name + parent_name' })
  @IsOptional()
  @IsString()
  search?: string;
}

@InputType({ description: 'Filter for listApplications (ROV-159)' })
export class ApplicationFilterInput {
  @Field(() => Int, { nullable: true, defaultValue: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  academicYearId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  standardId?: string;

  @Field({ nullable: true })
  @IsOptional()
  isRteApplication?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;
}
