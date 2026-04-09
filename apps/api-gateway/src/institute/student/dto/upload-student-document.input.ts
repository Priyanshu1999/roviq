import { Field, ID, InputType } from '@nestjs/graphql';

/**
 * Input for the `uploadStudentDocument` mutation (ROV-167).
 *
 * The actual file bytes are uploaded by the client directly to object
 * storage (MinIO/S3); this mutation records the resulting URLs against
 * the student's `user_documents` row. Multi-page scans are supported via
 * the `fileUrls` array.
 */
@InputType({
  description: 'Input for uploading document metadata (with pre-uploaded file URLs) to a student',
})
export class UploadStudentDocumentInput {
  @Field(() => ID, { description: 'Target student profile id (tenant-scoped)' })
  studentProfileId!: string;

  /**
   * One of the 17 values enforced by the `chk_document_type` CHECK
   * constraint on `user_documents.type` (birth_certificate, tc_incoming,
   * report_card, aadhaar_card, caste_certificate, income_certificate,
   * ews_certificate, medical_certificate, disability_certificate,
   * address_proof, passport_photo, family_photo, bpl_card,
   * transfer_order, noc, affidavit, other).
   */
  @Field(() => String, { description: 'Document type (see user_documents.type CHECK)' })
  type!: string;

  @Field(() => String, { nullable: true, description: 'Optional free-text description' })
  description?: string;

  @Field(() => [String], {
    description: 'S3/MinIO URLs (one per page for multi-page scans).',
  })
  fileUrls!: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Document reference number (e.g. TC number, certificate number).',
  })
  referenceNumber?: string;
}
