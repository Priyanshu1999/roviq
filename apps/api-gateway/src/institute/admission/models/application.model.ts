import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import GraphQLJSON from 'graphql-type-json';
import { createConnectionType } from '../../../common/pagination/relay-pagination.model';

@ObjectType({ description: 'Admission application' })
export class ApplicationModel {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field(() => String, { nullable: true })
  enquiryId?: string | null;

  @Field()
  academicYearId!: string;

  @Field()
  standardId!: string;

  @Field(() => String, { nullable: true })
  sectionId?: string | null;

  @Field(() => GraphQLJSON)
  formData!: Record<string, unknown>;

  @Field()
  status!: string;

  @Field()
  isRteApplication!: boolean;

  @Field(() => String, { nullable: true })
  testScore?: string | null;

  @Field(() => String, { nullable: true })
  interviewScore?: string | null;

  @Field(() => Int, { nullable: true })
  meritRank?: number | null;

  @Field(() => Int, { nullable: true })
  rteLotteryRank?: number | null;

  @Field(() => DateTimeScalar, { nullable: true })
  offeredAt?: Date | null;

  @Field(() => DateTimeScalar, { nullable: true })
  offerExpiresAt?: Date | null;

  @Field(() => DateTimeScalar, { nullable: true })
  offerAcceptedAt?: Date | null;

  @Field(() => String, { nullable: true })
  studentProfileId?: string | null;

  @Field(() => Int)
  version!: number;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}

export const { ConnectionType: ApplicationConnection } = createConnectionType(
  ApplicationModel,
  'Application',
);

@ObjectType()
export class ApplicationStatusUpdate {
  @Field()
  applicationId!: string;

  @Field()
  oldStatus!: string;

  @Field()
  newStatus!: string;
}
