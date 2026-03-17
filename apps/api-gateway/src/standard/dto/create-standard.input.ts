import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { EducationLevelEnum, NepStageEnum } from '../models/standard.model';

@InputType()
export class CreateStandardInput {
  @Field(() => ID)
  academicYearId!: string;

  @Field()
  name!: string;

  @Field(() => Int)
  numericOrder!: number;

  @Field(() => EducationLevelEnum, { nullable: true })
  level?: string;

  @Field(() => NepStageEnum, { nullable: true })
  nepStage?: string;

  @Field({ nullable: true })
  department?: string;

  @Field({ nullable: true, defaultValue: false })
  isBoardExamClass?: boolean;

  @Field({ nullable: true, defaultValue: false })
  streamApplicable?: boolean;

  @Field(() => Int, { nullable: true })
  maxSectionsAllowed?: number;

  @Field(() => Int, { nullable: true, defaultValue: 40 })
  maxStudentsPerSection?: number;

  @Field(() => Int, { nullable: true })
  udiseClassCode?: number;
}
