import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { EmploymentType, Gender, SocialCategory } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';

registerEnumType(EmploymentType, {
  name: 'EmploymentType',
  description: 'Staff employment arrangement with the institute.',
});

@ObjectType({ description: 'Staff member profile with employment details' })
export class StaffModel {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  membershipId!: string;

  // ── Personal (joined from user_profiles) ──────────────────
  /**
   * First name resolved from `user_profiles`. Required by the staff list
   * page (rov-169) which displays "Name" as a primary column. Cannot be
   * null because every staff member has a user profile created on staff
   * creation.
   */
  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar)
  firstName!: I18nContent;

  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar, { nullable: true })
  lastName?: I18nContent | null;

  @Field(() => Gender, { nullable: true })
  gender?: Gender | null;

  @Field(() => String, { nullable: true })
  dateOfBirth?: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;

  @Field(() => String, { nullable: true, description: 'Institute-assigned employee ID' })
  employeeId?: string | null;

  @Field(() => String, { nullable: true })
  designation?: string | null;

  @Field(() => String, { nullable: true })
  department?: string | null;

  @Field(() => String, { nullable: true })
  dateOfJoining?: string | null;

  @Field(() => String, { nullable: true })
  dateOfLeaving?: string | null;

  @Field(() => EmploymentType, { nullable: true })
  employmentType?: EmploymentType | null;

  @Field(() => Boolean)
  isClassTeacher!: boolean;

  @Field(() => SocialCategory, { nullable: true })
  socialCategory?: SocialCategory | null;

  @Field(() => String, { nullable: true })
  specialization?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;

  /**
   * Row version used for optimistic concurrency on `updateStaffMember`.
   * Exposed so the profile edit form can submit `input.version` for the
   * compare-and-swap update — see `staff.service.ts#update` and rov-169.
   */
  @Field(() => Int)
  version!: number;
}

@ObjectType({ description: 'Staff statistics by department' })
export class StaffStatistics {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  active!: number;

  @Field(() => Int)
  classTeachers!: number;

  @Field(() => [DepartmentCount])
  byDepartment!: DepartmentCount[];
}

@ObjectType()
export class DepartmentCount {
  @Field()
  department!: string;

  @Field(() => Int)
  count!: number;
}
