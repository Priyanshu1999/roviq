import { Field, InputType } from '@nestjs/graphql';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import GraphQLJSON from 'graphql-type-json';
import { InstituteTypeEnum, StructureFrameworkEnum } from '../models/institute.model';

@InputType()
export class CreateInstituteInput {
  @Field(() => GraphQLJSON)
  name!: Record<string, string>;

  @Field()
  slug!: string;

  @Field({ nullable: true })
  code?: string;

  @Field(() => InstituteTypeEnum, { nullable: true, defaultValue: 'SCHOOL' })
  type?: string;

  @Field(() => StructureFrameworkEnum, { nullable: true, defaultValue: 'TRADITIONAL' })
  structureFramework?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  contact?: InstituteContact;

  @Field(() => GraphQLJSON, { nullable: true })
  address?: InstituteAddress;

  @Field(() => [String], { nullable: true })
  departments?: string[];

  @Field({ nullable: true })
  board?: string;

  @Field({ nullable: true, defaultValue: false })
  isDemo?: boolean;
}
