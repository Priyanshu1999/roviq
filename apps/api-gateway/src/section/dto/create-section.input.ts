import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { GenderRestrictionEnum, StreamTypeEnum } from '../models/section.model';

@InputType()
export class CreateSectionInput {
  @Field(() => ID)
  standardId!: string;

  @Field(() => ID)
  academicYearId!: string;

  @Field()
  name!: string;

  @Field({ nullable: true })
  displayLabel?: string;

  @Field(() => StreamTypeEnum, { nullable: true })
  stream?: string;

  @Field({ nullable: true })
  medium?: string;

  @Field({ nullable: true })
  shift?: string;

  @Field({ nullable: true })
  room?: string;

  @Field(() => Int, { nullable: true, defaultValue: 40 })
  capacity?: number;

  @Field(() => GenderRestrictionEnum, { nullable: true, defaultValue: 'CO_ED' })
  genderRestriction?: string;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  displayOrder?: number;

  @Field({ nullable: true })
  startTime?: string;

  @Field({ nullable: true })
  endTime?: string;
}
