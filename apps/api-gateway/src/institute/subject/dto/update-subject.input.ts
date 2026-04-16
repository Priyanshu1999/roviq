import { Field, InputType, Int } from '@nestjs/graphql';
import { SubjectType } from '@roviq/common-types';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

@InputType({
  description: 'Fields that can be updated on an existing subject. All fields are optional.',
})
export class UpdateSubjectInput {
  @IsString()
  @IsOptional()
  @Field({ nullable: true, description: 'Display name of the subject.' })
  name?: string;

  @IsString()
  @MaxLength(10)
  @IsOptional()
  @Field({
    nullable: true,
    description: 'Abbreviated label shown in timetables, e.g. "Math". Max 10 characters.',
  })
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
    description: 'Subject category that controls grading rules and report card placement.',
  })
  type?: SubjectType;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    description: 'Whether attendance in this subject is compulsory for promotion.',
  })
  isMandatory?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
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
  @Field({ nullable: true, description: 'Whether students can opt into or out of this subject.' })
  isElective?: boolean;

  @IsString()
  @IsOptional()
  @Field({
    nullable: true,
    description: 'Groups elective subjects so the system enforces one-per-group selection.',
  })
  electiveGroup?: string;
}
