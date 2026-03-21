import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EducationLevelEnum, NepStageEnum } from '../models/standard.model';

@InputType()
export class UpdateStandardInput {
  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  name?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  numericOrder?: number;

  @IsEnum(EducationLevelEnum)
  @IsOptional()
  @Field(() => EducationLevelEnum, { nullable: true })
  level?: EducationLevelEnum;

  @IsEnum(NepStageEnum)
  @IsOptional()
  @Field(() => NepStageEnum, { nullable: true })
  nepStage?: NepStageEnum;

  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  department?: string;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true })
  isBoardExamClass?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true })
  streamApplicable?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  maxSectionsAllowed?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  maxStudentsPerSection?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  udiseClassCode?: number;
}
