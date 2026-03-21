import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SubjectTypeEnum } from '../models/subject.model';

@InputType()
export class UpdateSubjectInput {
  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  name?: string;

  @IsString()
  @MaxLength(10)
  @IsOptional()
  @Field({ nullable: true })
  shortName?: string;

  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  boardCode?: string;

  @IsEnum(SubjectTypeEnum)
  @IsOptional()
  @Field(() => SubjectTypeEnum, { nullable: true })
  type?: SubjectTypeEnum;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true })
  isMandatory?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true })
  hasPractical?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  theoryMarks?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  practicalMarks?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  @Field(() => Int, { nullable: true })
  internalMarks?: number;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true })
  isElective?: boolean;

  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  electiveGroup?: string;
}
