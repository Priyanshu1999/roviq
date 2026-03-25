import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
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
  @Field()
  firstName!: string;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  nameLocal?: string | null;

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
  @Field(() => String, { nullable: true })
  currentStandardId?: string | null;

  @Field(() => String, { nullable: true })
  currentSectionId?: string | null;

  @Field(() => String, { nullable: true })
  currentAcademicYearId?: string | null;

  @Field(() => String, { nullable: true })
  rollNumber?: string | null;

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
