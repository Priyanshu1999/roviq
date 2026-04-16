import { Field, InputType, Int } from '@nestjs/graphql';
import { EducationLevel, NepStage } from '@roviq/common-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

@InputType({
  description: 'Fields that can be updated on an existing standard. All fields are optional.',
})
export class UpdateStandardInput {
  @IsObject()
  @IsOptional()
  @Field(() => I18nTextScalar, {
    nullable: true,
    description: 'Localised name, e.g. { en: "Class 5", hi: "कक्षा 5" }.',
  })
  name?: Record<string, string>;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, {
    nullable: true,
    description: 'Sort order used for display in timetables and reports (0 = first).',
  })
  numericOrder?: number;

  @IsEnum(EducationLevel)
  @IsOptional()
  @Field(() => EducationLevel, {
    nullable: true,
    description:
      'Education level this standard falls under (pre-primary through senior secondary).',
  })
  level?: EducationLevel;

  @IsEnum(NepStage)
  @IsOptional()
  @Field(() => NepStage, {
    nullable: true,
    description: 'NEP 2020 stage. Required when the institute uses the NEP structure framework.',
  })
  nepStage?: NepStage;

  @IsString()
  @IsOptional()
  @Field({
    nullable: true,
    description:
      'Department for this standard, e.g. "Science". Relevant for senior-secondary only.',
  })
  department?: string;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    description: 'Whether students in this standard appear in board examinations.',
  })
  isBoardExamClass?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    description:
      'Whether stream selection (Science/Commerce/Arts) applies to sections in this standard.',
  })
  streamApplicable?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, {
    nullable: true,
    description: 'Maximum number of sections allowed for this standard. Null means unlimited.',
  })
  maxSectionsAllowed?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, {
    nullable: true,
    description: 'Default maximum students per section. Can be overridden per section.',
  })
  maxStudentsPerSection?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, {
    nullable: true,
    description: 'UDISE+ class code for Ministry of Education government reporting.',
  })
  udiseClassCode?: number;
}
