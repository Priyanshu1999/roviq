import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

export enum GroupTypeEnum {
  TRUST = 'TRUST',
  SOCIETY = 'SOCIETY',
  CHAIN = 'CHAIN',
  FRANCHISE = 'FRANCHISE',
}

export enum GroupStatusEnum {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

registerEnumType(GroupTypeEnum, { name: 'GroupType' });
registerEnumType(GroupStatusEnum, { name: 'GroupStatus' });

@ObjectType()
export class InstituteGroupModel {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field()
  code!: string;

  @Field(() => GroupTypeEnum)
  type!: GroupTypeEnum;

  @Field(() => String, { nullable: true })
  registrationNumber?: string | null;

  @Field(() => String, { nullable: true })
  registrationState?: string | null;

  @Field(() => GraphQLJSON)
  contact!: Record<string, unknown>;

  @Field(() => GraphQLJSON, { nullable: true })
  address?: Record<string, unknown> | null;

  @Field(() => GroupStatusEnum)
  status!: GroupStatusEnum;

  @Field()
  createdBy!: string;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Int, { description: 'Optimistic concurrency version counter' })
  version!: number;

  @Field(() => Date)
  updatedAt!: Date;
}
