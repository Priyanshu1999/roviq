import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import GraphQLJSON from 'graphql-type-json';
import { createConnectionType } from '../../../common/pagination/relay-pagination.model';

@ObjectType({
  description: 'Student profile with resolved user profile and current academic record',
})
export class StudentModel {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  userId!: string;

  @Field()
  membershipId!: string;

  // ── Personal (from user_profiles) ───────────────────────
  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar)
  firstName!: I18nContent;

  /** Multilingual via i18nText; resolved via useI18nField() on the frontend. */
  @Field(() => I18nTextScalar, { nullable: true })
  lastName?: I18nContent | null;

  @Field(() => String, { nullable: true })
  gender?: string | null;

  @Field(() => String, { nullable: true })
  dateOfBirth?: string | null;

  @Field(() => String, { nullable: true })
  bloodGroup?: string | null;

  @Field(() => String, { nullable: true })
  religion?: string | null;

  @Field(() => String, { nullable: true })
  motherTongue?: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;

  // ── Admission ───────────────────────────────────────────
  @Field()
  admissionNumber!: string;

  @Field()
  admissionDate!: string;

  @Field(() => String, { nullable: true })
  admissionClass?: string | null;

  @Field()
  admissionType!: string;

  // ── Academic status ─────────────────────────────────────
  @Field()
  academicStatus!: string;

  // ── Regulatory ──────────────────────────────────────────
  @Field()
  socialCategory!: string;

  @Field(() => String, { nullable: true })
  caste?: string | null;

  @Field()
  isMinority!: boolean;

  @Field(() => String, { nullable: true })
  minorityType?: string | null;

  @Field()
  isBpl!: boolean;

  @Field()
  isCwsn!: boolean;

  @Field(() => String, { nullable: true })
  cwsnType?: string | null;

  @Field()
  isRteAdmitted!: boolean;

  @Field(() => String, { nullable: true })
  rteCertificate?: string | null;

  // ── TC ──────────────────────────────────────────────────
  @Field()
  tcIssued!: boolean;

  @Field(() => String, { nullable: true })
  tcNumber?: string | null;

  @Field(() => String, { nullable: true })
  tcIssuedDate?: string | null;

  @Field(() => String, { nullable: true })
  tcReason?: string | null;

  @Field(() => String, { nullable: true })
  dateOfLeaving?: string | null;

  // ── Previous school ─────────────────────────────────────
  @Field(() => String, { nullable: true })
  previousSchoolName?: string | null;

  @Field(() => String, { nullable: true })
  previousSchoolBoard?: string | null;

  // ── Current academic record ─────────────────────────────
  /**
   * Id of the student_academics row for the currently-active academic year.
   * Needed by mutations that target the academic record (e.g. section
   * change) so clients don't have to re-query. Null when the student has no
   * row in the active year (e.g. just-created student, archived year).
   */
  @Field(() => String, { nullable: true })
  currentStudentAcademicId?: string | null;

  @Field(() => String, { nullable: true })
  currentStandardId?: string | null;

  @Field(() => String, { nullable: true })
  currentSectionId?: string | null;

  @Field(() => String, { nullable: true })
  currentAcademicYearId?: string | null;

  @Field(() => String, { nullable: true })
  rollNumber?: string | null;

  /** Denormalised standard/section names for list view. */
  @Field(() => String, { nullable: true })
  currentStandardName?: string | null;

  @Field(() => String, { nullable: true })
  currentSectionName?: string | null;

  /**
   * Primary guardian (is_primary_contact = true) display name — denormalised
   * onto the list row to avoid N+1 lookups on the students table.
   * Resolved from user_profiles joined through guardian_profiles.
   */
  @Field(() => I18nTextScalar, { nullable: true })
  primaryGuardianFirstName?: I18nContent | null;

  @Field(() => I18nTextScalar, { nullable: true })
  primaryGuardianLastName?: I18nContent | null;

  // ── Medical ─────────────────────────────────────────────
  @Field(() => GraphQLJSON, { nullable: true })
  medicalInfo?: Record<string, unknown> | null;

  // ── Metadata ────────────────────────────────────────────
  @Field(() => Int)
  version!: number;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

/** Relay-style StudentConnection for paginated list */
export const { ConnectionType: StudentConnection, EdgeType: StudentEdge } = createConnectionType(
  StudentModel,
  'Student',
);
