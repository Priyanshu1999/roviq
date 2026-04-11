import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { CertificateStatus, TcStatus } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType({ description: 'Department clearance record for TC workflow' })
export class ClearanceEntryObject {
  @Field({ description: 'Department name (e.g. accounts, library, lab, transport)' })
  department!: string;

  @Field({ description: 'Whether this department has cleared the student' })
  cleared!: boolean;

  @Field({ nullable: true, description: 'User ID who cleared' })
  by?: string;

  @Field({ nullable: true, description: 'ISO timestamp when cleared' })
  at?: string;

  @Field({ nullable: true, description: 'Optional notes from the department' })
  notes?: string;
}

registerEnumType(TcStatus, { name: 'TcStatus' });
registerEnumType(CertificateStatus, { name: 'CertificateStatus' });

@ObjectType({ description: 'Transfer Certificate register entry' })
export class TCModel {
  @Field(() => ID)
  id!: string;

  @Field()
  studentProfileId!: string;

  @Field(() => I18nTextScalar, {
    description: 'Student first name (i18n) joined from user_profiles',
  })
  studentFirstName!: I18nContent;

  @Field(() => I18nTextScalar, {
    nullable: true,
    description: 'Student last name (i18n) joined from user_profiles',
  })
  studentLastName?: I18nContent | null;

  @Field(() => String, {
    nullable: true,
    description: "Class/standard studied snapshot from tcData->>'class_studied'",
  })
  currentStandardName?: string | null;

  @Field()
  tcSerialNumber!: string;

  @Field()
  academicYearId!: string;

  @Field(() => TcStatus)
  status!: TcStatus;

  @Field()
  reason!: string;

  /** 20+ CBSE fields snapshotted at generation — dynamic per board, kept as JSON */
  @Field(() => GraphQLJSON, { nullable: true, description: 'CBSE 20-field TC data snapshot' })
  tcData?: Record<string, unknown>;

  @Field(() => [ClearanceEntryObject], {
    nullable: true,
    description: 'Department clearance records',
  })
  clearances?: ClearanceEntryObject[];

  @Field(() => String, { nullable: true })
  pdfUrl?: string | null;

  @Field(() => String, { nullable: true })
  qrVerificationUrl?: string | null;

  @Field(() => Boolean)
  isDuplicate!: boolean;

  @Field(() => String, { nullable: true })
  originalTcId?: string | null;

  @Field(() => Boolean, { nullable: true })
  isCounterSigned?: boolean;

  @Field()
  createdAt!: Date;
}

@ObjectType({ description: 'Issued certificate (bonafide, character, etc.)' })
export class CertificateModel {
  @Field(() => ID)
  id!: string;

  @Field()
  templateId!: string;

  @Field(() => String, { nullable: true })
  studentProfileId?: string | null;

  @Field(() => String, { nullable: true })
  staffProfileId?: string | null;

  @Field()
  serialNumber!: string;

  @Field(() => CertificateStatus)
  status!: CertificateStatus;

  @Field(() => GraphQLJSON)
  certificateData!: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  pdfUrl?: string | null;

  @Field(() => String, { nullable: true })
  purpose?: string | null;

  @Field()
  createdAt!: Date;
}
