import { Field, InputType } from '@nestjs/graphql';
import { HolidayType } from '@roviq/common-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

@InputType({ description: 'Edit a holiday — any subset of fields may be supplied.' })
export class UpdateHolidayInput {
  @IsOptional()
  @Field(() => I18nTextScalar, {
    nullable: true,
    description: 'Localised name. English key must remain populated.',
  })
  name?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Field(() => String, { nullable: true })
  description?: string | null;

  @IsOptional()
  @IsEnum(HolidayType)
  @Field(() => HolidayType, { nullable: true })
  type?: HolidayType;

  @IsOptional()
  @IsDateString()
  @Field(() => String, { nullable: true })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  @Field(() => String, { nullable: true })
  endDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Field(() => [String], { nullable: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, { nullable: true })
  isPublic?: boolean;
}
