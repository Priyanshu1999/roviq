import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { DateTimeScalar } from '@roviq/nestjs-graphql';

export enum SubjectTypeEnum {
  ACADEMIC = 'ACADEMIC',
  LANGUAGE = 'LANGUAGE',
  SKILL = 'SKILL',
  EXTRACURRICULAR = 'EXTRACURRICULAR',
  INTERNAL_ASSESSMENT = 'INTERNAL_ASSESSMENT',
}

registerEnumType(SubjectTypeEnum, { name: 'SubjectType' });

@ObjectType()
export class SubjectModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  shortName?: string | null;

  @Field(() => String, { nullable: true })
  boardCode?: string | null;

  @Field(() => SubjectTypeEnum)
  type!: SubjectTypeEnum;

  @Field()
  isMandatory!: boolean;

  @Field()
  hasPractical!: boolean;

  @Field(() => Int, { nullable: true })
  theoryMarks?: number | null;

  @Field(() => Int, { nullable: true })
  practicalMarks?: number | null;

  @Field(() => Int, { nullable: true })
  internalMarks?: number | null;

  @Field()
  isElective!: boolean;

  @Field(() => String, { nullable: true })
  electiveGroup?: string | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}
