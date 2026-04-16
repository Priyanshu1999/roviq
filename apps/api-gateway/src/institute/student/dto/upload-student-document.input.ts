import { Field, ID, InputType } from '@nestjs/graphql';
import { UserDocumentType } from '@roviq/common-types';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

/**
 * Input for the `uploadStudentDocument` mutation (ROV-167).
 *
 * The actual file bytes are uploaded by the client directly to object
 * storage (MinIO/S3); this mutation records the resulting URLs against
 * the student's `user_documents` row. Multi-page scans are supported via
 * the `fileUrls` array.
 */
@InputType({
  description:
    'Input for uploading document metadata (with pre-uploaded MinIO/S3 URLs) against a student profile.',
})
export class UploadStudentDocumentInput {
  @Field(() => ID, { description: 'Target student profile ID (tenant-scoped UUIDv7).' })
  @IsUUID()
  @IsNotEmpty()
  studentProfileId!: string;

  @Field(() => UserDocumentType, {
    description:
      'Document category — must match one of the 17 values enforced by the user_documents.type CHECK constraint.',
  })
  @IsEnum(UserDocumentType)
  type!: UserDocumentType;

  @Field(() => String, {
    nullable: true,
    description: 'Optional human-readable description of the document contents.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => [String], {
    description: 'One or more MinIO/S3 URLs — one URL per page for multi-page scans.',
  })
  @IsArray()
  @IsUrl({}, { each: true })
  fileUrls!: string[];

  @Field(() => String, {
    nullable: true,
    description:
      'Document reference number for traceability, e.g. TC number, certificate serial number.',
  })
  @IsOptional()
  @IsString()
  referenceNumber?: string;
}
