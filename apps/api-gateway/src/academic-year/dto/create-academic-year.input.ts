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

@InputType()
export class CreateAcademicYearInput {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, { message: 'label must be in YYYY-YY format (e.g. 2025-26)' })
  @Field()
  label!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  @Field()
  startDate!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  @Field()
  endDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermConfigInput)
  @IsOptional()
  @Field(() => [TermConfigInput], { nullable: true, description: 'Term/semester breakdown' })
  termStructure?: TermConfigInput[];
}
