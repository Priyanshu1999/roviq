import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';

export enum StreamTypeEnum {
  SCIENCE = 'SCIENCE',
  COMMERCE = 'COMMERCE',
  ARTS = 'ARTS',
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

registerEnumType(StreamTypeEnum, { name: 'StreamType' });
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

  @Field()
  name!: string;

  @Field({ nullable: true })
  displayLabel?: string | null;

  @Field(() => StreamTypeEnum, { nullable: true })
  stream?: string | null;

  @Field({ nullable: true })
  medium?: string | null;

  @Field({ nullable: true })
  shift?: string | null;

  @Field({ nullable: true })
  classTeacherId?: string | null;

  @Field({ nullable: true })
  room?: string | null;

  @Field(() => Int, { nullable: true })
  capacity?: number | null;

  @Field(() => Int)
  currentStrength!: number;

  @Field(() => GenderRestrictionEnum)
  genderRestriction!: string;

  @Field(() => Int)
  displayOrder!: number;

  @Field({ nullable: true })
  startTime?: string | null;

  @Field({ nullable: true })
  endTime?: string | null;

  @Field(() => BatchStatusEnum, { nullable: true })
  batchStatus?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
