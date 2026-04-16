import { Field, ID, ObjectType } from '@nestjs/graphql';
import { DateOnlyScalar, DateTimeScalar } from '@roviq/nestjs-graphql';

/**
 * A single uploaded document for a student, used by the "Documents" tab
 * on the student detail page (ROV-167).
 *
 * Backed by the platform-level `user_documents` table (no RLS — scoped per
 * tenant via the join through `student_profiles → users`). Each row may
 * have multiple file URLs because some documents are multi-page scans.
 */
@ObjectType({
  description: 'A user document upload (birth certificate, TC, report card, etc.)',
})
export class StudentDocumentModel {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  /**
   * Document type — one of the enumerated CHECK values on the column
   * (birth_certificate, tc_incoming, report_card, aadhaar_card, …).
   */
  @Field()
  type!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  /** Array of S3/MinIO URLs — supports multi-page scans. */
  @Field(() => [String])
  fileUrls!: string[];

  /** Document's own reference/serial number (TC number, certificate number). */
  @Field(() => String, { nullable: true })
  referenceNumber?: string | null;

  /** Whether an admin has verified this document. */
  @Field()
  isVerified!: boolean;

  @Field(() => String, { nullable: true })
  verifiedAt?: string | null;

  @Field(() => String, { nullable: true })
  verifiedBy?: string | null;

  /** Rejection reason — populated when admin rejects a document upload. */
  @Field(() => String, { nullable: true })
  rejectionReason?: string | null;

  /** Validity expiry — relevant for time-bound certificates. */
  @Field(() => DateOnlyScalar, { nullable: true })
  expiryDate?: string | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}
