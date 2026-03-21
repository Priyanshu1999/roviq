import { Field, InputType } from '@nestjs/graphql';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { InstituteTypeEnum, StructureFrameworkEnum } from '../models/institute.model';

@InputType()
export class CreateInstituteInput {
  @Field(() => GraphQLJSON)
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

  @Field(() => InstituteTypeEnum, { nullable: true, defaultValue: 'SCHOOL' })
  @IsEnum(InstituteTypeEnum)
  @IsOptional()
  type?: InstituteTypeEnum;

  @Field(() => StructureFrameworkEnum, { nullable: true, defaultValue: 'TRADITIONAL' })
  @IsEnum(StructureFrameworkEnum)
  @IsOptional()
  structureFramework?: StructureFrameworkEnum;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => GraphQLJSON, { nullable: true })
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
