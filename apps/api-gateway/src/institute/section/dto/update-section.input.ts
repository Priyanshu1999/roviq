import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { BatchStatus, GenderRestriction } from '@roviq/common-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { StreamInput } from '../models/section.model';

@InputType({
  description: 'Fields that can be updated on an existing section. All fields are optional.',
})
export class UpdateSectionInput {
  @IsOptional()
  @IsObject()
  @Field(() => I18nTextScalar, {
    nullable: true,
    description: 'Localised section name, e.g. { en: "5-A", hi: "5-अ" }.',
  })
  name?: Record<string, string>;

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
  @IsUUID()
  @Field(() => ID, {
    nullable: true,
    description:
      'Membership ID of the staff member assigned as class teacher. Pass null to unassign.',
  })
  classTeacherId?: string | null;

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
    description: 'Maximum number of students allowed in this section.',
  })
  capacity?: number;

  @IsOptional()
  @IsEnum(GenderRestriction)
  @Field(() => GenderRestriction, {
    nullable: true,
    description: 'Gender enrollment restriction for this section.',
  })
  genderRestriction?: GenderRestriction;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, {
    nullable: true,
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

  @IsOptional()
  @IsEnum(BatchStatus)
  @Field(() => BatchStatus, {
    nullable: true,
    description: 'Lifecycle state of this section batch (Upcoming → Active → Completed).',
  })
  batchStatus?: BatchStatus;
}
