import { Field, Float, InputType } from '@nestjs/graphql';
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
  Matches,
} from 'class-validator';

// ── Contact / Address input types ──

@InputType()
export class InstitutePhoneInput {
  @Field()
  countryCode!: string;

  @Field()
  number!: string;

  @Field()
  isPrimary!: boolean;

  @Field()
  isWhatsappEnabled!: boolean;

  @Field()
  label!: string;
}

@InputType()
export class InstituteEmailInput {
  @Field()
  address!: string;

  @Field()
  isPrimary!: boolean;

  @Field()
  label!: string;
}

@InputType()
export class InstituteContactInput {
  @Field(() => [InstitutePhoneInput])
  phones!: InstitutePhoneInput[];

  @Field(() => [InstituteEmailInput])
  emails!: InstituteEmailInput[];
}

@InputType()
export class CoordinatesInput {
  @Field(() => Float)
  lat!: number;

  @Field(() => Float)
  lng!: number;
}

@InputType()
export class InstituteAddressInput {
  @Field()
  line1!: string;

  @Field({ nullable: true })
  line2?: string;

  @Field({ nullable: true })
  line3?: string;

  @Field()
  city!: string;

  @Field()
  district!: string;

  @Field()
  state!: string;

  @Field()
  postalCode!: string;

  @Field()
  country!: string;

  @Field(() => CoordinatesInput, { nullable: true })
  coordinates?: CoordinatesInput;
}

// ── Main input ──

@InputType()
export class CreateInstituteInput {
  @Field(() => I18nTextScalar)
  @IsObject()
  name!: Record<string, string>;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  code?: string;

  @Field(() => InstituteType, { nullable: true, defaultValue: 'SCHOOL' })
  @IsEnum(InstituteType)
  @IsOptional()
  type?: InstituteType;

  @Field(() => StructureFramework, { nullable: true, defaultValue: 'TRADITIONAL' })
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

  @Field(() => [String], { nullable: true })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  departments?: string[];

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  board?: string;

  @Field({ nullable: true, defaultValue: false })
  @IsOptional()
  isDemo?: boolean;
}
