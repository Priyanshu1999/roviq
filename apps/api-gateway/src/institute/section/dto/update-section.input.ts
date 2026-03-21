import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { BatchStatusEnum, GenderRestrictionEnum, StreamTypeEnum } from '../models/section.model';

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
