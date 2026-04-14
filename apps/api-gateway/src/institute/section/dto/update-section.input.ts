import { Field, ID, InputType, Int } from '@nestjs/graphql';
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
import { BatchStatusEnum, GenderRestrictionEnum, StreamInput } from '../models/section.model';

@InputType()
export class UpdateSectionInput {
  @IsOptional()
  @Field(() => I18nTextScalar, { nullable: true })
  name?: Record<string, string>;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  displayLabel?: string;

  @IsOptional()
  @IsObject()
  @Field(() => StreamInput, { nullable: true })
  stream?: StreamInput;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  mediumOfInstruction?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  shift?: string;

  @IsOptional()
  @IsUUID()
  @Field(() => ID, { nullable: true })
  classTeacherId?: string | null;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  room?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, { nullable: true })
  capacity?: number;

  @IsOptional()
  @IsEnum(GenderRestrictionEnum)
  @Field(() => GenderRestrictionEnum, { nullable: true })
  genderRestriction?: GenderRestrictionEnum;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, { nullable: true })
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'must be HH:mm or HH:mm:ss' })
  @Field({ nullable: true })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'must be HH:mm or HH:mm:ss' })
  @Field({ nullable: true })
  endTime?: string;

  @IsOptional()
  @IsEnum(BatchStatusEnum)
  @Field(() => BatchStatusEnum, { nullable: true })
  batchStatus?: BatchStatusEnum;
}
