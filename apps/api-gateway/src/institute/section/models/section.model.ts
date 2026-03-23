import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

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

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  displayLabel?: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  stream?: { name: string; code: string } | null;

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
