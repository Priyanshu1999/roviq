import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { EducationLevel, NepStage } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';

registerEnumType(EducationLevel, {
  name: 'EducationLevel',
  description: 'Department (education level) of a standard — pre-primary through senior secondary.',
});
registerEnumType(NepStage, {
  name: 'NepStage',
  description: 'NEP 2020 stage a standard belongs to (Foundational → Secondary).',
});

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

  @Field(() => EducationLevel, { nullable: true })
  level?: EducationLevel | null;

  @Field(() => NepStage, { nullable: true })
  nepStage?: NepStage | null;

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
