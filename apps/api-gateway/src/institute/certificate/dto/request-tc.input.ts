import { Field, ID, InputType } from '@nestjs/graphql';
import { CertificateStatus, CertificateTemplateType, TcStatus } from '@roviq/common-types';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

@InputType({
  description:
    'Input for requesting a Transfer Certificate (TC) for a student leaving the institute.',
})
export class RequestTCInput {
  @Field(() => ID, { description: 'Student profile to issue the TC for.' })
  @IsUUID()
  studentProfileId!: string;

  @Field(() => ID, { description: 'Academic year in which the student is leaving.' })
  @IsUUID()
  academicYearId!: string;

  @Field({
    description:
      'Reason for leaving — printed verbatim on the TC, e.g. "Family relocated to another city".',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

@InputType({
  description: 'Input for requesting a duplicate TC when the original is lost or damaged.',
})
export class RequestDuplicateTCInput {
  @Field(() => ID, { description: 'ID of the original issued TC being duplicated.' })
  @IsUUID()
  originalTcId!: string;

  @Field({
    description:
      'Reason for the duplicate request, e.g. FIR reference number or affidavit details.',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Duplicate issuance fee in paise (100 paise = ₹1), stored as a BIGINT string to avoid floating-point loss.',
  })
  @IsOptional()
  @IsString()
  duplicateFee?: string;
}

@InputType({ description: 'Filter for listing Transfer Certificates.' })
export class ListTCFilterInput {
  @Field(() => TcStatus, { nullable: true, description: 'Filter by TC lifecycle status.' })
  @IsOptional()
  @IsEnum(TcStatus)
  status?: TcStatus;

  @Field(() => ID, { nullable: true, description: 'Filter to TCs for a specific student profile.' })
  @IsOptional()
  @IsUUID()
  studentProfileId?: string;
}

@InputType({
  description: 'Input for requesting a bonafide or custom certificate from a template.',
})
export class RequestCertificateInput {
  @Field(() => ID, { description: 'Certificate template to use for generation.' })
  @IsUUID()
  templateId!: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Student profile to populate template fields with. Mutually exclusive with staffProfileId.',
  })
  @IsOptional()
  @IsUUID()
  studentProfileId?: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Staff profile to populate template fields with. Mutually exclusive with studentProfileId.',
  })
  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @Field({
    description:
      'Purpose of the certificate — printed on the document, e.g. "Bank Loan", "Scholarship Application".',
  })
  @IsString()
  @IsNotEmpty()
  purpose!: string;
}

@InputType({ description: 'Filter for listing issued certificates.' })
export class ListCertificateFilterInput {
  @Field(() => String, { nullable: true, description: 'Filter by certificate template type.' })
  @IsOptional()
  @IsString()
  type?: CertificateTemplateType;

  @Field(() => CertificateStatus, {
    nullable: true,
    description: 'Filter by certificate lifecycle status.',
  })
  @IsOptional()
  @IsEnum(CertificateStatus)
  status?: CertificateStatus;

  @Field(() => ID, {
    nullable: true,
    description: 'Filter to certificates for a specific student profile.',
  })
  @IsOptional()
  @IsUUID()
  studentProfileId?: string;
}
