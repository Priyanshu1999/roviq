import { Field, ID, InputType } from '@nestjs/graphql';

@InputType({ description: 'Request a Transfer Certificate for a student' })
export class RequestTCInput {
  @Field(() => ID)
  studentProfileId!: string;

  @Field(() => ID)
  academicYearId!: string;

  @Field({ description: 'Reason for leaving (shown on TC)' })
  reason!: string;
}

@InputType({ description: 'Request a duplicate Transfer Certificate' })
export class RequestDuplicateTCInput {
  @Field(() => ID, { description: 'ID of the original issued TC' })
  originalTcId!: string;

  @Field({ description: 'Reason for duplicate (FIR reference, affidavit details)' })
  reason!: string;

  @Field(() => String, { nullable: true, description: 'Duplicate fee in paise (BIGINT)' })
  duplicateFee?: string;
}

@InputType({ description: 'Filter for listing TCs' })
export class ListTCFilterInput {
  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => ID, { nullable: true })
  studentProfileId?: string;
}

@InputType({ description: 'Request a certificate from template' })
export class RequestCertificateInput {
  @Field(() => ID, { description: 'Certificate template ID' })
  templateId!: string;

  @Field(() => ID, { nullable: true })
  studentProfileId?: string;

  @Field(() => ID, { nullable: true })
  staffProfileId?: string;

  @Field({ description: 'Purpose of the certificate' })
  purpose!: string;
}

@InputType({ description: 'Filter for listing certificates' })
export class ListCertificateFilterInput {
  @Field(() => String, { nullable: true })
  type?: string;

  @Field(() => String, { nullable: true })
  status?: string;

  @Field(() => ID, { nullable: true })
  studentProfileId?: string;
}
