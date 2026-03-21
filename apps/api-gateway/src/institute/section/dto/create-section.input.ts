import { Field, ID, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { GenderRestrictionEnum, StreamTypeEnum } from '../models/section.model';

@InputType()
export class CreateSectionInput {
  @IsUUID()
  @Field(() => ID)
  standardId!: string;

  @IsUUID()
  @Field(() => ID)
  academicYearId!: string;

  @IsString()
  @IsNotEmpty()
  @Field()
  name!: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  displayLabel?: string;

  @IsOptional()
  @IsEnum(StreamTypeEnum)
  @Field(() => StreamTypeEnum, { nullable: true })
  stream?: StreamTypeEnum;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  medium?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  shift?: string;

  @IsOptional()
  @IsString()
  @Field({ nullable: true })
  room?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, { nullable: true, defaultValue: 40 })
  capacity?: number;

  @IsOptional()
  @IsEnum(GenderRestrictionEnum)
  @Field(() => GenderRestrictionEnum, { nullable: true, defaultValue: 'CO_ED' })
  genderRestriction?: GenderRestrictionEnum;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Field(() => Int, { nullable: true, defaultValue: 0 })
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
}
