import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { TermConfigInput } from '../../institute/management/dto/update-institute-config.input';

@InputType({
  description: 'Fields that can be updated on an existing academic year. All fields are optional.',
})
export class UpdateAcademicYearInput {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, { message: 'label must be in YYYY-YY format (e.g. 2025-26)' })
  @IsOptional()
  @Field({ nullable: true, description: 'Academic year label in YYYY-YY format, e.g. "2025-26".' })
  label?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  @IsOptional()
  @Field({ nullable: true, description: 'First day of the academic year (ISO date YYYY-MM-DD).' })
  startDate?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  @IsOptional()
  @Field({ nullable: true, description: 'Last day of the academic year (ISO date YYYY-MM-DD).' })
  endDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermConfigInput)
  @IsOptional()
  @Field(() => [TermConfigInput], {
    nullable: true,
    description: 'Optional term or semester breakdown within this academic year.',
  })
  termStructure?: TermConfigInput[];

  /** Board exam dates keyed by board name — dynamic keys, kept as JSON */
  @IsObject()
  @IsOptional()
  @Field(() => GraphQLJSON, {
    nullable: true,
    description:
      'Board exam dates keyed by board name, e.g. { "CBSE": "2026-03-01", "BSEH": "2026-03-10" }.',
  })
  boardExamDates?: Record<string, unknown>;
}
