import { Field, InputType } from '@nestjs/graphql';
import { LeaveType } from '@roviq/common-types';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

@InputType({ description: 'Edit a PENDING leave — dates, type, reason, or supporting files.' })
export class UpdateLeaveInput {
  @IsOptional()
  @IsDateString()
  @Field(() => String, { nullable: true })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @Field(() => String, { nullable: true })
  endDate?: string;

  @IsOptional()
  @IsEnum(LeaveType)
  @Field(() => LeaveType, { nullable: true })
  type?: LeaveType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Field(() => String, { nullable: true })
  reason?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  fileUrls?: string[];
}
