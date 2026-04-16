import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { SubjectType } from '@roviq/common-types';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

@InputType({ description: 'Fields required to create a new subject in this institute.' })
export class CreateSubjectInput {
  @IsString()
  @IsNotEmpty()
  @Field({ description: 'Display name of the subject, e.g. "Mathematics" or "Hindi".' })
  name!: string;

  @IsString()
  @MaxLength(10)
  @IsOptional()
  @Field({ nullable: true, description: 'Abbreviated label shown in timetables, e.g. "Math".' })
  shortName?: string;

  @IsString()
  @IsOptional()
  @Field({
    nullable: true,
    description: 'Board-assigned subject code used in marksheets and result uploads.',
  })
  boardCode?: string;

  @IsEnum(SubjectType)
  @IsOptional()
  @Field(() => SubjectType, {
    nullable: true,
    defaultValue: 'ACADEMIC',
    description: 'Subject category that controls grading rules and report card placement.',
  })
  type?: SubjectType;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    defaultValue: false,
    description: 'Whether attendance in this subject is compulsory for promotion.',
  })
  isMandatory?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    defaultValue: false,
    description: 'Whether a separate practical component exists alongside theory.',
  })
  hasPractical?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, {
    nullable: true,
    description: 'Maximum marks allocated to the theory component.',
  })
  theoryMarks?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, {
    nullable: true,
    description: 'Maximum marks allocated to the practical component.',
  })
  practicalMarks?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, {
    nullable: true,
    description: 'Maximum marks for internal/continuous assessment.',
  })
  internalMarks?: number;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    defaultValue: false,
    description: 'Whether students can opt into or out of this subject.',
  })
  isElective?: boolean;

  @IsString()
  @IsOptional()
  @Field({
    nullable: true,
    description: 'Groups elective subjects so the system enforces one-per-group selection.',
  })
  electiveGroup?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  @Field(() => [ID], {
    nullable: true,
    description: 'Standards (grade levels) this subject is assigned to.',
  })
  standardIds?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  @Field(() => [ID], {
    nullable: true,
    description:
      'Sections this subject is directly assigned to (overrides standard-level assignment).',
  })
  sectionIds?: string[];
}
