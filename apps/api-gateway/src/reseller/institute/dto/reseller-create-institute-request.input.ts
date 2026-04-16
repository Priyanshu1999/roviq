import { Field, InputType } from '@nestjs/graphql';
import { InstituteType, StructureFramework } from '@roviq/common-types';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import {
  IsArray,
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
  description: 'Fields required for a reseller to submit an institute creation request.',
})
export class ResellerCreateInstituteRequestInput {
  @Field(() => I18nTextScalar, {
    description:
      'Multilingual institute name, e.g. { "en": "Sunrise Academy", "hi": "सनराइज अकादमी" }.',
  })
  @IsObject()
  name!: Record<string, string>;

  @Field({
    description:
      'Unique URL-safe slug — lowercase alphanumerics and hyphens, e.g. "sunrise-academy".',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Short internal code for the institute, e.g. "SA-JDH".',
  })
  @IsString()
  @IsOptional()
  code?: string;

  @Field(() => InstituteType, {
    nullable: true,
    defaultValue: 'SCHOOL',
    description: 'Legal/organisational type of the institute. Defaults to SCHOOL.',
  })
  @IsEnum(InstituteType)
  @IsOptional()
  type?: InstituteType;

  @Field(() => StructureFramework, {
    nullable: true,
    defaultValue: 'TRADITIONAL',
    description: 'Curriculum structure framework. Defaults to TRADITIONAL.',
  })
  @IsEnum(StructureFramework)
  @IsOptional()
  structureFramework?: StructureFramework;

  @Field(() => InstituteContactInput, {
    nullable: true,
    description: 'Primary contact details for the institute.',
  })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => InstituteAddressInput, {
    nullable: true,
    description: 'Physical address of the institute.',
  })
  @IsObject()
  @IsOptional()
  address?: InstituteAddress;

  @Field(() => [String], {
    nullable: true,
    description: 'Education departments offered, e.g. ["primary", "secondary"].',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departments?: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Affiliated board name, e.g. "CBSE", "RBSE".',
  })
  @IsString()
  @IsOptional()
  board?: string;

  @Field(() => String, {
    nullable: true,
    description: 'ID of the institute group (trust/chain/society) this institute belongs to.',
  })
  @IsUUID()
  @IsOptional()
  groupId?: string;
}
