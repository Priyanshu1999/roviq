import { Field, InputType } from '@nestjs/graphql';
import { GroupType } from '@roviq/common-types';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, Matches } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class CreateInstituteGroupInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'code must be lowercase alphanumeric with hyphens' })
  code!: string;

  @Field(() => GroupType)
  @IsEnum(GroupType)
  type!: GroupType;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  registrationState?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  address?: InstituteAddress;
}
