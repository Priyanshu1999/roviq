import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { TermConfigInput } from '../../institute/management/dto/update-institute-config.input';

@InputType()
export class UpdateAcademicYearInput {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, { message: 'label must be in YYYY-YY format (e.g. 2025-26)' })
  @IsOptional()
  @Field({ nullable: true })
  label?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  @IsOptional()
  @Field({ nullable: true })
  startDate?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  @IsOptional()
  @Field({ nullable: true })
  endDate?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermConfigInput)
  @IsOptional()
  @Field(() => [TermConfigInput], { nullable: true, description: 'Term/semester breakdown' })
  termStructure?: TermConfigInput[];

  /** Board exam dates keyed by board name — dynamic keys, kept as JSON */
  @IsOptional()
  @Field(() => GraphQLJSON, { nullable: true, description: 'Board exam dates keyed by board name' })
  boardExamDates?: Record<string, unknown>;
}
