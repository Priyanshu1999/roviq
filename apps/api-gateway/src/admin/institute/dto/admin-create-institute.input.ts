import { Field, InputType } from '@nestjs/graphql';
import { BoardType, EducationLevel, InstituteType, StructureFramework } from '@roviq/common-types';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import {
  InstituteAddressInput,
  InstituteContactInput,
} from '../../../institute/management/dto/create-institute.input';

@InputType({
  description:
    'Platform-admin input for creating a new institute. Supports assigning to a specific reseller and group.',
})
export class AdminCreateInstituteInput {
  @Field(() => I18nTextScalar, {
    description: 'Localised institute name, e.g. { en: "Sunrise Academy", hi: "सनराइज़ अकैडमी" }.',
  })
  @IsObject()
  name!: Record<string, string>;

  @Field({
    description:
      'URL-safe slug — globally unique, lowercase alphanumerics and hyphens, e.g. "sunrise-academy-jaipur".',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Short internal code for the institute, e.g. "SAJ". Unique per reseller.',
  })
  @IsString()
  @IsOptional()
  code?: string;

  @Field(() => InstituteType, {
    nullable: true,
    defaultValue: 'SCHOOL',
  })
  @IsEnum(InstituteType)
  @IsOptional()
  type?: InstituteType;

  @Field(() => StructureFramework, {
    nullable: true,
    defaultValue: 'TRADITIONAL',
    description: 'Academic structure — NEP 2020 (5+3+3+4 stages) or legacy 10+2.',
  })
  @IsEnum(StructureFramework)
  @IsOptional()
  structureFramework?: StructureFramework;

  @Field(() => InstituteContactInput, { nullable: true })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => InstituteAddressInput, { nullable: true })
  @IsObject()
  @IsOptional()
  address?: InstituteAddress;

  @Field(() => [EducationLevel], {
    nullable: true,
    description: 'Education levels offered, e.g. [PRIMARY, UPPER_PRIMARY].',
  })
  @IsArray()
  @IsEnum(EducationLevel, { each: true })
  @IsOptional()
  departments?: EducationLevel[];

  @Field(() => BoardType, { nullable: true })
  @IsEnum(BoardType)
  @IsOptional()
  board?: BoardType;

  @Field(() => String, {
    nullable: true,
    description:
      'Reseller to assign this institute to. Defaults to the platform "Roviq Direct" reseller when omitted.',
  })
  @IsUUID()
  @IsOptional()
  resellerId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Institute group (trust, chain, or society) to assign this institute to.',
  })
  @IsUUID()
  @IsOptional()
  groupId?: string;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description: 'Whether this is a demo/sandbox institute — excludes it from production reports.',
  })
  @IsBoolean()
  @IsOptional()
  isDemo?: boolean;
}
