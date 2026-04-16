import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { QualificationType } from '@roviq/common-types';
import { DateTimeScalar } from '@roviq/nestjs-graphql';

registerEnumType(QualificationType, {
  name: 'QualificationType',
  description:
    'Whether a staff qualification is an academic degree or a professional certification.',
});

/**
 * Staff qualification — one row per academic degree or professional
 * certification. Mirrors the `staff_qualifications` table used for UDISE+
 * DCF teacher qualification reporting.
 */
@ObjectType({ description: 'Structured staff qualification (academic degree or certification)' })
export class StaffQualificationModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  staffProfileId!: string;

  @Field(() => QualificationType)
  type!: QualificationType;

  @Field(() => String)
  degreeName!: string;

  @Field(() => String, { nullable: true })
  institution?: string | null;

  @Field(() => String, { nullable: true })
  boardUniversity?: string | null;

  @Field(() => Int, { nullable: true })
  yearOfPassing?: number | null;

  @Field(() => String, { nullable: true })
  gradePercentage?: string | null;

  @Field(() => String, { nullable: true })
  certificateUrl?: string | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;
}
