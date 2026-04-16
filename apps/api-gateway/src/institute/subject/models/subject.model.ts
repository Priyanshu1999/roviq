import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { SubjectType } from '@roviq/common-types';
import { DateTimeScalar } from '@roviq/nestjs-graphql';

registerEnumType(SubjectType, {
  name: 'SubjectType',
  description: 'Category of a subject — determines how it is graded and reported.',
});

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

  @Field(() => SubjectType)
  type!: SubjectType;

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
