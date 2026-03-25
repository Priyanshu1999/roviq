import { Field, ID, ObjectType } from '@nestjs/graphql';
import { createConnectionType } from '../../../common/pagination/relay-pagination.model';

@ObjectType({ description: 'Pre-admission enquiry' })
export class EnquiryModel {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  studentName!: string;

  @Field(() => String, { nullable: true })
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

  @Field(() => String, { nullable: true })
  followUpDate?: string | null;

  @Field(() => Date, { nullable: true })
  lastContactedAt?: Date | null;

  @Field(() => String, { nullable: true })
  convertedToApplicationId?: string | null;

  /** Whether a duplicate enquiry exists (same phone + class) */
  @Field({ nullable: true })
  isDuplicate?: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

export const { ConnectionType: EnquiryConnection } = createConnectionType(EnquiryModel, 'Enquiry');
