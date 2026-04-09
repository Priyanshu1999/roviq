import { Field, ID, InputType } from '@nestjs/graphql';

/**
 * Input for the `previewCertificate` query — renders a certificate
 * template's HTML body with a student's data substituted in, without
 * persisting an `issued_certificates` row.
 *
 * Used by the "Preview" button in the Issue Certificate dialog so
 * operators can verify the output before committing to issuance
 * (ROV-170).
 */
@InputType({ description: 'Input for previewing a certificate before issuance' })
export class PreviewCertificateInput {
  @Field(() => ID, { description: 'Certificate template ID' })
  templateId!: string;

  @Field(() => ID, { description: 'Student profile ID to populate the template with' })
  studentProfileId!: string;

  @Field(() => String, { nullable: true, description: 'Optional purpose string for the preview' })
  purpose?: string;
}
