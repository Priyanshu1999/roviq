import { Field, InputType, Int } from '@nestjs/graphql';
import { EducationLevelEnum, NepStageEnum } from '../models/standard.model';

@InputType()
export class UpdateStandardInput {
  @Field({ nullable: true })
  name?: string;

  @Field(() => Int, { nullable: true })
  numericOrder?: number;

  @Field(() => EducationLevelEnum, { nullable: true })
  level?: string;

  @Field(() => NepStageEnum, { nullable: true })
  nepStage?: string;

  @Field({ nullable: true })
  department?: string;

  @Field({ nullable: true })
  isBoardExamClass?: boolean;

  @Field({ nullable: true })
  streamApplicable?: boolean;

  @Field(() => Int, { nullable: true })
  maxSectionsAllowed?: number;

  @Field(() => Int, { nullable: true })
  maxStudentsPerSection?: number;

  @Field(() => Int, { nullable: true })
  udiseClassCode?: number;
}
