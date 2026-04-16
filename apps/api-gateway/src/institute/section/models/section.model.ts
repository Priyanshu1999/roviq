import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { BatchStatus, GenderRestriction } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';

@ObjectType()
export class StreamObject {
  @Field()
  name!: string;

  @Field()
  code!: string;
}

@InputType({ description: 'Stream (specialisation) for a section — name and short code.' })
export class StreamInput {
  @Field({ description: 'Human-readable stream name, e.g. "Science" or "Commerce".' })
  name!: string;

  @Field({ description: 'Short code used in reports, e.g. "SC", "CO", "AR".' })
  code!: string;
}

registerEnumType(GenderRestriction, {
  name: 'GenderRestriction',
  description: 'Gender enrollment restriction on a section or institute.',
});
registerEnumType(BatchStatus, {
  name: 'BatchStatus',
  description: 'Lifecycle state of a section batch within an academic year.',
});

@ObjectType()
export class SectionModel {
  @Field(() => ID)
  id!: string;

  @Field()
  standardId!: string;

  @Field()
  academicYearId!: string;

  @Field(() => I18nTextScalar)
  name!: I18nContent;

  @Field(() => String, { nullable: true })
  displayLabel?: string | null;

  @Field(() => StreamObject, { nullable: true })
  stream?: StreamObject | null;

  @Field(() => String, { nullable: true })
  mediumOfInstruction?: string | null;

  @Field(() => String, { nullable: true })
  shift?: string | null;

  @Field(() => String, { nullable: true })
  classTeacherId?: string | null;

  @Field(() => String, { nullable: true })
  room?: string | null;

  @Field(() => Int, { nullable: true })
  capacity?: number | null;

  @Field(() => Int)
  currentStrength!: number;

  @Field(() => GenderRestriction)
  genderRestriction!: GenderRestriction;

  @Field(() => Int)
  displayOrder!: number;

  @Field(() => String, { nullable: true })
  startTime?: string | null;

  @Field(() => String, { nullable: true })
  endTime?: string | null;

  @Field(() => BatchStatus, { nullable: true })
  batchStatus?: BatchStatus | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}
