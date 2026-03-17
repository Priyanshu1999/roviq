import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { BatchStatusEnum, GenderRestrictionEnum, StreamTypeEnum } from '../models/section.model';

@InputType()
export class UpdateSectionInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  displayLabel?: string;

  @Field(() => StreamTypeEnum, { nullable: true })
  stream?: string;

  @Field({ nullable: true })
  medium?: string;

  @Field({ nullable: true })
  shift?: string;

  @Field(() => ID, { nullable: true })
  classTeacherId?: string | null;

  @Field({ nullable: true })
  room?: string;

  @Field(() => Int, { nullable: true })
  capacity?: number;

  @Field(() => GenderRestrictionEnum, { nullable: true })
  genderRestriction?: string;

  @Field(() => Int, { nullable: true })
  displayOrder?: number;

  @Field({ nullable: true })
  startTime?: string;

  @Field({ nullable: true })
  endTime?: string;

  @Field(() => BatchStatusEnum, { nullable: true })
  batchStatus?: string;
}
