import { Field, ID, InputType, Int } from '@nestjs/graphql';
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
import GraphQLJSON from 'graphql-type-json';
import { BatchStatusEnum, GenderRestrictionEnum } from '../models/section.model';

@InputType()
export class UpdateSectionInput {
  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  name?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  displayLabel?: string;

  @IsOptional()
  @IsObject()
  @Field(() => GraphQLJSON, { nullable: true })
  stream?: { name: string; code: string };

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
