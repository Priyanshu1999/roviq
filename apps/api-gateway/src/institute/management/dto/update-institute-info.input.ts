import { Field, InputType } from '@nestjs/graphql';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import { IsObject, IsOptional, IsString, Length } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';

@InputType()
export class UpdateInstituteInfoInput {
  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  name?: Record<string, string>;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  code?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @IsObject()
  @IsOptional()
  contact?: InstituteContact;

  @Field(() => GraphQLJSON, { nullable: true })
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
