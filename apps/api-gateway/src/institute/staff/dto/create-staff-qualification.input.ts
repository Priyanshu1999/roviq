import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

/**
 * Input for adding a new qualification record to a staff profile.
 *
 * `type` is constrained to the same two values as the CHECK constraint on
 * the `staff_qualifications` table so that invalid categories are rejected
 * at the GraphQL layer before touching the DB.
 */
@InputType({ description: 'Input for creating a staff qualification' })
export class CreateStaffQualificationInput {
  @Field(() => ID)
  @IsUUID()
  staffProfileId!: string;

  @Field(() => String, { description: 'academic | professional' })
  @IsIn(['academic', 'professional'])
  type!: string;

  @Field(() => String)
  @IsString()
  @MaxLength(100)
  degreeName!: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  boardUniversity?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearOfPassing?: number;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gradePercentage?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  certificateUrl?: string;
}
