import { Field, ID, InputType, Int } from '@nestjs/graphql';
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
import { SubjectTypeEnum } from '../models/subject.model';

@InputType()
export class CreateSubjectInput {
  @IsString()
  @IsNotEmpty()
  @Field()
  name!: string;

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
  @Field(() => SubjectTypeEnum, { nullable: true, defaultValue: 'ACADEMIC' })
  type?: SubjectTypeEnum;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true, defaultValue: false })
  isMandatory?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true, defaultValue: false })
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
  @Field({ nullable: true, defaultValue: false })
  isElective?: boolean;

  @IsString()
  @IsOptional()
  @Field({ nullable: true })
  electiveGroup?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  @Field(() => [ID], { nullable: true })
  standardIds?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  @Field(() => [ID], { nullable: true })
  sectionIds?: string[];
}
