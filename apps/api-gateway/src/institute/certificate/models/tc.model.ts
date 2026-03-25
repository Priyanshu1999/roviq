import { Field, ID, ObjectType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

@ObjectType({ description: 'Transfer Certificate register entry' })
export class TCModel {
  @Field(() => ID)
  id!: string;

  @Field()
  studentProfileId!: string;

  @Field()
  tcSerialNumber!: string;

  @Field()
  academicYearId!: string;

  @Field()
  status!: string;

  @Field()
  reason!: string;

  @Field(() => GraphQLJSON, { nullable: true, description: 'CBSE 20-field TC data snapshot' })
  tcData?: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Department clearances JSONB' })
  clearances?: Record<string, unknown>;

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

  @Field()
  status!: string;

  @Field(() => GraphQLJSON)
  certificateData!: Record<string, unknown>;

  @Field(() => String, { nullable: true })
  pdfUrl?: string | null;

  @Field(() => String, { nullable: true })
  purpose?: string | null;

  @Field()
  createdAt!: Date;
}
