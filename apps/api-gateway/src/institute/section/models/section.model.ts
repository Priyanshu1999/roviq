import { Field, ID, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';

@ObjectType()
export class StreamObject {
  @Field()
  name!: string;

  @Field()
  code!: string;
}

@InputType()
export class StreamInput {
  @Field()
  name!: string;

  @Field()
  code!: string;
}

export enum GenderRestrictionEnum {
  CO_ED = 'CO_ED',
  BOYS_ONLY = 'BOYS_ONLY',
  GIRLS_ONLY = 'GIRLS_ONLY',
}

export enum BatchStatusEnum {
  UPCOMING = 'UPCOMING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}

registerEnumType(GenderRestrictionEnum, { name: 'GenderRestriction' });
registerEnumType(BatchStatusEnum, { name: 'BatchStatus' });

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

  @Field(() => GenderRestrictionEnum)
  genderRestriction!: GenderRestrictionEnum;

  @Field(() => Int)
  displayOrder!: number;

  @Field(() => String, { nullable: true })
  startTime?: string | null;

  @Field(() => String, { nullable: true })
  endTime?: string | null;

  @Field(() => BatchStatusEnum, { nullable: true })
  batchStatus?: BatchStatusEnum | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
