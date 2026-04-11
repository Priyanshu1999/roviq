import { Field, Float, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType({ description: 'Shift period (e.g. morning 8:00–12:30)' })
export class ShiftConfigInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field({ description: 'HH:mm format' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'start must be HH:mm' })
  start!: string;

  @Field({ description: 'HH:mm format' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'end must be HH:mm' })
  end!: string;
}

@InputType({ description: 'Term/semester period within an academic year' })
export class TermConfigInput {
  @Field({ description: 'Display label (e.g. "Term 1", "Semester 2")' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @Field({ description: 'ISO date YYYY-MM-DD' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'startDate must be YYYY-MM-DD' })
  startDate!: string;

  @Field({ description: 'ISO date YYYY-MM-DD' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'endDate must be YYYY-MM-DD' })
  endDate!: string;
}

@InputType({ description: 'CBSE/board section size constraints' })
export class SectionStrengthNormsInput {
  @Field(() => Float, { description: 'Ideal students per section (e.g. 40 for CBSE)' })
  @IsNumber()
  @Min(1)
  optimal!: number;

  @Field(() => Float, { description: 'Absolute max students (with exemption)' })
  @IsNumber()
  @Min(1)
  hardMax!: number;

  @Field({ description: 'Whether the hard max can be exceeded with principal approval' })
  @IsBoolean()
  exemptionAllowed!: boolean;
}

@InputType()
export class UpdateInstituteConfigInput {
  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  attendanceType?: string;

  @Field({ nullable: true })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'openingTime must be HH:mm' })
  @IsOptional()
  openingTime?: string;

  @Field({ nullable: true })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'closingTime must be HH:mm' })
  @IsOptional()
  closingTime?: string;

  @Field(() => [ShiftConfigInput], { nullable: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShiftConfigInput)
  @IsOptional()
  shifts?: ShiftConfigInput[];

  /** Dynamic per-institute notification preferences — shape varies */
  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  notificationPreferences?: Record<string, unknown>;

  /** Dynamic per-institute payroll configuration — shape varies */
  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  payrollConfig?: Record<string, unknown>;

  /** Dynamic per-institute grading system — shape varies */
  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  gradingSystem?: Record<string, unknown>;

  @Field(() => [TermConfigInput], { nullable: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TermConfigInput)
  @IsOptional()
  termStructure?: TermConfigInput[];

  @Field(() => SectionStrengthNormsInput, { nullable: true })
  @ValidateNested()
  @Type(() => SectionStrengthNormsInput)
  @IsOptional()
  sectionStrengthNorms?: SectionStrengthNormsInput;
}
