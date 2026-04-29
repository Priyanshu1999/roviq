import { Field, InputType } from '@nestjs/graphql';
import { HolidayType } from '@roviq/common-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

@InputType({
  description:
    'Fields required to publish a new holiday. Single-day holidays set startDate = endDate.',
})
export class CreateHolidayInput {
  @IsNotEmpty()
  @Field(() => I18nTextScalar, {
    description: 'Localised name, e.g. { en: "Diwali", hi: "दिवाली" }. English is required.',
  })
  name!: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Field(() => String, {
    nullable: true,
    description: 'Optional free-text notes (circular reference, background, etc.).',
  })
  description?: string;

  @IsEnum(HolidayType)
  @Field(() => HolidayType, { description: 'Classification of the holiday.' })
  type!: HolidayType;

  @IsDateString()
  @Field(() => String, { description: 'Inclusive start date (ISO YYYY-MM-DD).' })
  startDate!: string;

  @IsDateString()
  @Field(() => String, {
    description:
      'Inclusive end date (ISO YYYY-MM-DD). For a single-day holiday, pass the same value as startDate.',
  })
  endDate!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Field(() => [String], {
    nullable: true,
    description: 'Optional tags for filtering/theming (e.g. ["gazetted", "restricted"]).',
  })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  @Field(() => Boolean, {
    nullable: true,
    defaultValue: true,
    description:
      'Whether the holiday is visible to non-admin users. `false` means draft/admin-only — still blocks attendance.',
  })
  isPublic?: boolean;
}
