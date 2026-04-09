import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * Staff qualification — one row per academic degree or professional
 * certification. Mirrors the `staff_qualifications` table used for UDISE+
 * DCF teacher qualification reporting.
 *
 * `type` is one of:
 *  - `academic`     — formal degree (Secondary, Graduate, Post Graduate, M.Phil, Ph.D)
 *  - `professional` — teaching certification (D.El.Ed, B.Ed, M.Ed, CTET, etc.)
 */
@ObjectType({ description: 'Structured staff qualification (academic degree or certification)' })
export class StaffQualificationModel {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  staffProfileId!: string;

  @Field(() => String, { description: 'academic | professional' })
  type!: string;

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

  @Field()
  createdAt!: Date;
}
