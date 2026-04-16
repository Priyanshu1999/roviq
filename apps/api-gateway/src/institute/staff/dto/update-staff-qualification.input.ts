import { Field, InputType, Int } from '@nestjs/graphql';
import { QualificationType } from '@roviq/common-types';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from 'class-validator';

/**
 * Input for editing an existing staff qualification record. Every field is
 * optional — only provided fields are updated. `staffProfileId` cannot be
 * re-parented (would violate tenant isolation guarantees), so it is not
 * accepted here.
 */
@InputType({
  description:
    'Input for updating an existing staff qualification record. All fields are optional.',
})
export class UpdateStaffQualificationInput {
  @Field(() => QualificationType, {
    nullable: true,
    description: 'Whether this is an academic degree or a professional certification.',
  })
  @IsOptional()
  @IsEnum(QualificationType)
  type?: QualificationType;

  @Field(() => String, {
    nullable: true,
    description: 'Name of the degree or certification, e.g. "B.Ed", "CTET", "M.Sc Physics".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  degreeName?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Institution or university that awarded this qualification.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  institution?: string;

  @Field(() => String, { nullable: true, description: 'Examining board or university name.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  boardUniversity?: string;

  @Field(() => Int, { nullable: true, description: 'Year of passing/graduation (1900–2100).' })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  yearOfPassing?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Grade, percentage, or GPA as reported on the certificate, e.g. "85.5%", "A+".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  gradePercentage?: string;

  @Field(() => String, {
    nullable: true,
    description: 'MinIO/S3 URL of the uploaded certificate scan.',
  })
  @IsOptional()
  @IsUrl()
  certificateUrl?: string;
}
