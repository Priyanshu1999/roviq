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
import { TermConfigInput } from '../../institute/management/dto/update-institute-config.input';

@InputType({ description: 'Fields required to create a new academic year for the institute.' })
export class CreateAcademicYearInput {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, { message: 'label must be in YYYY-YY format (e.g. 2025-26)' })
  @Field({ description: 'Academic year label in YYYY-YY format, e.g. "2025-26".' })
  label!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  @Field({
    description: 'First day of the academic year (ISO date YYYY-MM-DD), e.g. "2025-04-01".',
  })
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  @Field({ description: 'Last day of the academic year (ISO date YYYY-MM-DD), e.g. "2026-03-31".' })
  endDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermConfigInput)
  @IsOptional()
  @Field(() => [TermConfigInput], {
    nullable: true,
    description: 'Optional term or semester breakdown within this academic year.',
  })
  termStructure?: TermConfigInput[];
}
