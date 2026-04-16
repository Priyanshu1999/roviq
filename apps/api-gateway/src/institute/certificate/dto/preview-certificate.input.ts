import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Input for the `previewCertificate` query — renders a certificate
 * template's HTML body with a student's data substituted in, without
 * persisting an `issued_certificates` row.
 *
 * Used by the "Preview" button in the Issue Certificate dialog so
 * operators can verify the output before committing to issuance
 * (ROV-170).
 */
@InputType({
  description:
    "Input for previewing a certificate template with a student's data, without persisting an issued certificate row.",
})
export class PreviewCertificateInput {
  @IsUUID()
  @Field(() => ID, { description: 'Certificate template ID to render.' })
  templateId!: string;

  @IsUUID()
  @Field(() => ID, { description: 'Student profile ID whose data populates the template fields.' })
  studentProfileId!: string;

  @IsString()
  @IsOptional()
  @Field(() => String, {
    nullable: true,
    description:
      'Purpose string substituted into the certificate body, e.g. "Bank Loan", "Scholarship".',
  })
  purpose?: string;
}
