import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';

export enum EducationLevelEnum {
  PRE_PRIMARY = 'PRE_PRIMARY',
  PRIMARY = 'PRIMARY',
  UPPER_PRIMARY = 'UPPER_PRIMARY',
  SECONDARY = 'SECONDARY',
  SENIOR_SECONDARY = 'SENIOR_SECONDARY',
}

export enum NepStageEnum {
  FOUNDATIONAL = 'FOUNDATIONAL',
  PREPARATORY = 'PREPARATORY',
  MIDDLE = 'MIDDLE',
  SECONDARY = 'SECONDARY',
}

registerEnumType(EducationLevelEnum, { name: 'EducationLevel' });
registerEnumType(NepStageEnum, { name: 'NepStage' });

@ObjectType()
export class StandardModel {
  @Field(() => ID)
  id!: string;

  @Field()
  academicYearId!: string;

  @Field(() => I18nTextScalar)
  name!: I18nContent;

  @Field(() => Int)
  numericOrder!: number;

  @Field(() => EducationLevelEnum, { nullable: true })
  level?: EducationLevelEnum | null;

  @Field(() => NepStageEnum, { nullable: true })
  nepStage?: NepStageEnum | null;

  @Field(() => String, { nullable: true })
  department?: string | null;

  @Field()
  isBoardExamClass!: boolean;

  @Field()
  streamApplicable!: boolean;

  @Field(() => Int, { nullable: true })
  maxSectionsAllowed?: number | null;

  @Field(() => Int, { nullable: true })
  maxStudentsPerSection?: number | null;

  @Field(() => Int, { nullable: true })
  udiseClassCode?: number | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}
