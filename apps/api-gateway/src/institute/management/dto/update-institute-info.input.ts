import { Field, InputType, Int } from '@nestjs/graphql';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { IsInt, IsObject, IsOptional, IsString, Length } from 'class-validator';
import { InstituteAddressInput, InstituteContactInput } from './create-institute.input';

@InputType()
export class UpdateInstituteInfoInput {
  @IsInt()
  @Field(() => Int)
  version!: number;

  @Field(() => I18nTextScalar, { nullable: true })
  @IsObject()
  @IsOptional()
  name?: Record<string, string>;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  code?: string;

  @Field(() => InstituteContactInput, { nullable: true })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => InstituteAddressInput, { nullable: true })
  @IsObject()
  @IsOptional()
  address?: InstituteAddress;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  timezone?: string;

  @Field({ nullable: true })
  @IsString()
  @Length(3, 3)
  @IsOptional()
  currency?: string;
}
