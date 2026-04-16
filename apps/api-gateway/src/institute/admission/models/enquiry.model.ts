import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AdmissionApplicationStatus, EnquirySource, EnquiryStatus } from '@roviq/common-types';
import { DateOnlyScalar, DateTimeScalar } from '@roviq/nestjs-graphql';
import { createConnectionType } from '../../../common/pagination/relay-pagination.model';

registerEnumType(EnquiryStatus, { name: 'EnquiryStatus' });
registerEnumType(EnquirySource, { name: 'EnquirySource' });
registerEnumType(AdmissionApplicationStatus, { name: 'AdmissionApplicationStatus' });

@ObjectType({ description: 'Pre-admission enquiry' })
export class EnquiryModel {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  /** Human-readable sequential enquiry number, e.g. ENQ-000123 */
  @Field(() => String, { nullable: true })
  enquiryNumber?: string | null;

  @Field()
  studentName!: string;

  @Field(() => DateOnlyScalar, { nullable: true })
  dateOfBirth?: string | null;

  @Field(() => String, { nullable: true })
  gender?: string | null;

  @Field()
  classRequested!: string;

  @Field(() => String, { nullable: true })
  academicYearId?: string | null;

  @Field()
  parentName!: string;

  @Field()
  parentPhone!: string;

  @Field(() => String, { nullable: true })
  parentEmail?: string | null;

  @Field(() => String, { nullable: true })
  parentRelation?: string | null;

  @Field()
  source!: string;

  @Field(() => String, { nullable: true })
  referredBy?: string | null;

  @Field(() => String, { nullable: true })
  assignedTo?: string | null;

  @Field(() => String, { nullable: true })
  previousSchool?: string | null;

  @Field(() => String, { nullable: true })
  previousBoard?: string | null;

  @Field()
  siblingInSchool!: boolean;

  @Field(() => String, { nullable: true })
  siblingAdmissionNo?: string | null;

  @Field(() => String, { nullable: true })
  specialNeeds?: string | null;

  @Field(() => String, { nullable: true })
  notes?: string | null;

  @Field()
  status!: string;

  @Field(() => DateOnlyScalar, { nullable: true })
  followUpDate?: string | null;

  @Field(() => DateTimeScalar, { nullable: true })
  lastContactedAt?: Date | null;

  @Field(() => String, { nullable: true })
  convertedToApplicationId?: string | null;

  /** Whether a duplicate enquiry exists (same phone + class) */
  @Field({ nullable: true })
  isDuplicate?: boolean;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}

export const { ConnectionType: EnquiryConnection } = createConnectionType(EnquiryModel, 'Enquiry');
