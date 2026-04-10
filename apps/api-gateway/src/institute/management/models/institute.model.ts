import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  InstituteStatus,
  InstituteType,
  SetupStatus,
  StructureFramework,
} from '@roviq/common-types';
import type { InstituteAddress, InstituteContact } from '@roviq/database';
import GraphQLJSON from 'graphql-type-json';

registerEnumType(InstituteType, { name: 'InstituteType' });
registerEnumType(StructureFramework, { name: 'StructureFramework' });
registerEnumType(SetupStatus, { name: 'SetupStatus' });
registerEnumType(InstituteStatus, { name: 'InstituteStatus' });

@ObjectType()
export class InstituteModel {
  @Field(() => ID)
  id!: string;

  @Field(() => GraphQLJSON)
  name!: Record<string, string>;

  @Field(() => String)
  slug!: string;

  @Field(() => String, { nullable: true })
  code?: string | null;

  @Field(() => InstituteType)
  type!: InstituteType;

  @Field(() => StructureFramework)
  structureFramework!: StructureFramework;

  @Field(() => SetupStatus)
  setupStatus!: SetupStatus;

  @Field(() => GraphQLJSON)
  contact!: InstituteContact;

  @Field(() => GraphQLJSON, { nullable: true })
  address?: InstituteAddress | null;

  @Field(() => String, { nullable: true })
  logoUrl?: string | null;

  @Field(() => String)
  timezone!: string;

  @Field(() => String)
  currency!: string;

  @Field(() => GraphQLJSON)
  settings!: Record<string, unknown>;

  @Field(() => InstituteStatus)
  status!: InstituteStatus;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;
}
