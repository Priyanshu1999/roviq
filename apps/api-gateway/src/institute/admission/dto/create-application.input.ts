import { Field, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType({ description: 'Input for creating an admission application (ROV-159)' })
export class CreateApplicationInput {
  @Field(() => ID, {
    nullable: true,
    description: 'Source enquiry ID (null for direct applications)',
  })
  @IsOptional()
  @IsUUID()
  enquiryId?: string;

  @Field(() => ID)
  @IsUUID()
  academicYearId!: string;

  @Field(() => ID)
  @IsUUID()
  standardId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @Field(() => GraphQLJSON, { description: 'Institute-specific admission form data' })
  formData!: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isRteApplication?: boolean;
}

@InputType({ description: 'Input for updating an application status (ROV-159)' })
export class UpdateApplicationInput {
  @Field({ description: 'New status (validated by state machine)' })
  @IsString()
  status!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Updated form data (partial merge)' })
  @IsOptional()
  formData?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  testScore?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  interviewScore?: string;

  @Field({ nullable: true })
  @IsOptional()
  meritRank?: number;
}
