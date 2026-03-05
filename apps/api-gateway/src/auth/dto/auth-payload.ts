import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-type-json';

@ObjectType()
export class UserType {
  @Field()
  id!: string;

  @Field()
  username!: string;

  @Field()
  email!: string;

  @Field()
  tenantId!: string;

  @Field({ nullable: true })
  roleId?: string;

  @Field(() => [GraphQLJSONObject], { nullable: true })
  abilityRules?: Record<string, unknown>[];
}

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken!: string;

  @Field()
  refreshToken!: string;

  @Field(() => UserType)
  user!: UserType;
}
