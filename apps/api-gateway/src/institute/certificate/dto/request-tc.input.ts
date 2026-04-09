import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID } from 'class-validator';

@InputType({ description: 'Request a Transfer Certificate for a student' })
export class RequestTCInput {
  @Field(() => ID)
  @IsUUID()
  studentProfileId!: string;

  @Field(() => ID)
  @IsUUID()
  academicYearId!: string;

  @Field({ description: 'Reason for leaving (shown on TC)' })
  @IsString()
  reason!: string;
}

@InputType({ description: 'Request a duplicate Transfer Certificate' })
export class RequestDuplicateTCInput {
  @Field(() => ID, { description: 'ID of the original issued TC' })
  @IsUUID()
  originalTcId!: string;

  @Field({ description: 'Reason for duplicate (FIR reference, affidavit details)' })
  @IsString()
  reason!: string;

  @Field(() => String, { nullable: true, description: 'Duplicate fee in paise (BIGINT)' })
  @IsOptional()
  @IsString()
  duplicateFee?: string;
}

@InputType({ description: 'Filter for listing TCs' })
export class ListTCFilterInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  studentProfileId?: string;
}

@InputType({ description: 'Request a certificate from template' })
export class RequestCertificateInput {
  @Field(() => ID, { description: 'Certificate template ID' })
  @IsUUID()
  templateId!: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  studentProfileId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  staffProfileId?: string;

  @Field({ description: 'Purpose of the certificate' })
  @IsString()
  purpose!: string;
}

@InputType({ description: 'Filter for listing certificates' })
export class ListCertificateFilterInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  type?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  studentProfileId?: string;
}
