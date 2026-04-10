import { Field, InputType, Int } from '@nestjs/graphql';
import { QualificationType } from '@roviq/common-types';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/**
 * Input for editing an existing staff qualification record. Every field is
 * optional — only provided fields are updated. `staffProfileId` cannot be
 * re-parented (would violate tenant isolation guarantees), so it is not
 * accepted here.
 */
@InputType({ description: 'Input for updating a staff qualification' })
export class UpdateStaffQualificationInput {
  @Field(() => String, { nullable: true, description: 'academic | professional' })
  @IsOptional()
  @IsIn(['academic', 'professional'])
  type?: QualificationType;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  degreeName?: string;

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
