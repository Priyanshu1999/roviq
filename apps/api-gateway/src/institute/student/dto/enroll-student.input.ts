import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID } from 'class-validator';

@InputType({ description: 'Input for enrolling a student in a section (ROV-154)' })
export class EnrollStudentInput {
  @Field(() => ID)
  @IsUUID()
  studentProfileId!: string;

  @Field(() => ID)
  @IsUUID()
  academicYearId!: string;

  @Field(() => ID)
  @IsUUID()
  standardId!: string;

  @Field(() => ID)
  @IsUUID()
  sectionId!: string;

  /** Required when section is at or above hard_max capacity */
  @Field({ nullable: true, description: 'Required reason when overriding capacity hard limit' })
  @IsOptional()
  @IsString()
  overrideReason?: string;
}

@InputType({ description: 'Input for changing a student section (ROV-154)' })
export class UpdateStudentSectionInput {
  @Field(() => ID)
  @IsUUID()
  studentAcademicId!: string;

  @Field(() => ID, { description: 'Target section to move the student to' })
  @IsUUID()
  newSectionId!: string;

  /** Required when target section is at or above hard_max capacity */
  @Field({ nullable: true, description: 'Required reason when overriding capacity hard limit' })
  @IsOptional()
  @IsString()
  overrideReason?: string;
}
