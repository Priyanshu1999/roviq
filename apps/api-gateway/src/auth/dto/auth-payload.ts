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

  @Field({ nullable: true })
  tenantId?: string;

  @Field({ nullable: true })
  roleId?: string;

  @Field(() => [GraphQLJSONObject], { nullable: true })
  abilityRules?: Record<string, unknown>[];
}

@ObjectType()
export class MembershipInfo {
  @Field()
  tenantId!: string;

  @Field()
  roleId!: string;

  @Field()
  orgName!: string;

  @Field()
  orgSlug!: string;

  @Field({ nullable: true })
  orgLogoUrl?: string;

  @Field()
  roleName!: string;
}

@ObjectType()
export class AuthPayload {
  @Field({ nullable: true })
  accessToken?: string;

  @Field({ nullable: true })
  refreshToken?: string;

  @Field(() => UserType, { nullable: true })
  user?: UserType;
}

@ObjectType()
export class LoginResult {
  @Field({ nullable: true })
  accessToken?: string;

  @Field({ nullable: true })
  refreshToken?: string;

  @Field(() => UserType, { nullable: true })
  user?: UserType;

  @Field({ nullable: true })
  platformToken?: string;

  @Field(() => [MembershipInfo], { nullable: true })
  memberships?: MembershipInfo[];
}
