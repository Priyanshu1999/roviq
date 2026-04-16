import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { QualificationType } from '@roviq/common-types';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Input for adding a new qualification record to a staff profile.
 *
 * `type` is constrained to the same two values as the CHECK constraint on
 * the `staff_qualifications` table so that invalid categories are rejected
 * at the GraphQL layer before touching the DB.
 */
@InputType({ description: 'Input for creating a staff qualification record.' })
export class CreateStaffQualificationInput {
  @Field(() => ID, { description: 'Staff profile to attach this qualification to.' })
  @IsUUID()
  staffProfileId!: string;

  @Field(() => QualificationType, {
    description: 'Whether this is an academic degree or a professional certification.',
  })
  @IsEnum(QualificationType)
  type!: QualificationType;

  @Field(() => String, {
    description: 'Name of the degree or certification, e.g. "B.Ed", "CTET", "M.Sc Physics".',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  degreeName!: string;

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
