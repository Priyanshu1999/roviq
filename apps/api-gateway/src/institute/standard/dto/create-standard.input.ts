import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { EducationLevelEnum, NepStageEnum } from '../models/standard.model';

@InputType()
export class CreateStandardInput {
  @IsUUID()
  @Field(() => ID)
  academicYearId!: string;

  @IsNotEmpty()
  @Field(() => I18nTextScalar)
  name!: Record<string, string>;

  @IsInt()
  @Min(0)
  @Field(() => Int)
  numericOrder!: number;

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
  @Field({ nullable: true, defaultValue: false })
  isBoardExamClass?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true, defaultValue: false })
  streamApplicable?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  maxSectionsAllowed?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true, defaultValue: 40 })
  maxStudentsPerSection?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  udiseClassCode?: number;
}
