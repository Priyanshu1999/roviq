import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { GenderRestriction } from '@roviq/common-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { StreamInput } from '../models/section.model';

@InputType({ description: 'Fields required to create a new class section under a standard.' })
export class CreateSectionInput {
  @IsUUID()
  @Field(() => ID, { description: 'Standard (grade level) this section belongs to.' })
  standardId!: string;

  @IsUUID()
  @Field(() => ID, { description: 'Academic year this section is created under.' })
  academicYearId!: string;

  @IsNotEmpty()
  @Field(() => I18nTextScalar, {
    description: 'Localised section name, e.g. { en: "5-A", hi: "5-अ" }.',
  })
  name!: Record<string, string>;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: 'Short display label shown in timetables, e.g. "A" or "Blue".',
  })
  displayLabel?: string;

  @IsOptional()
  @IsObject()
  @Field(() => StreamInput, {
    nullable: true,
    description:
      'Stream (specialisation) for this section. Only applies when streamApplicable is true on the parent standard.',
  })
  stream?: StreamInput;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: 'Primary language of instruction, e.g. "English" or "Hindi".',
  })
  mediumOfInstruction?: string;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description:
      'Shift identifier when the institute runs multiple shifts, e.g. "Morning" or "Evening".',
  })
  shift?: string;

  @IsOptional()
  @IsString()
  @Field({
    nullable: true,
    description: 'Room or classroom identifier, e.g. "Room 12" or "Lab B".',
  })
  room?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, {
    nullable: true,
    defaultValue: 40,
    description: 'Maximum number of students allowed in this section.',
  })
  capacity?: number;

  @IsOptional()
  @IsEnum(GenderRestriction)
  @Field(() => GenderRestriction, {
    nullable: true,
    defaultValue: 'CO_ED',
    description: 'Gender enrollment restriction for this section.',
  })
  genderRestriction?: GenderRestriction;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, {
    nullable: true,
    defaultValue: 0,
    description: 'Sort order among siblings of the same standard (ascending).',
  })
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'must be HH:mm or HH:mm:ss' })
  @Field({
    nullable: true,
    description: 'Section start time in HH:mm or HH:mm:ss (24-hour format).',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'must be HH:mm or HH:mm:ss' })
  @Field({ nullable: true, description: 'Section end time in HH:mm or HH:mm:ss (24-hour format).' })
  endTime?: string;

  @IsUUID()
  @IsOptional()
  @Field(() => ID, {
    nullable: true,
    description: 'Membership ID of the staff member assigned as class teacher.',
  })
  classTeacherId?: string;
}
