import { Field, ObjectType } from '@nestjs/graphql';
import type { AbilityRule } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';
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
  scope?: string;

  @Field({ nullable: true })
  tenantId?: string;

  @Field({ nullable: true })
  resellerId?: string;

  @Field({ nullable: true })
  membershipId?: string;

  @Field({ nullable: true })
  roleId?: string;

  @Field(() => [GraphQLJSONObject], { nullable: true })
  abilityRules?: AbilityRule[];
}

@ObjectType()
export class MembershipInfo {
  @Field()
  membershipId!: string;

  @Field()
  tenantId!: string;

  @Field()
  roleId!: string;

  @Field(() => I18nTextScalar)
  instituteName!: I18nContent;

  @Field()
  instituteSlug!: string;

  @Field({ nullable: true })
  instituteLogoUrl?: string;

  @Field(() => I18nTextScalar)
  roleName!: I18nContent;
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
export class InstituteLoginResult {
  // Direct login path (single institute)
  @Field({ nullable: true })
  accessToken?: string;

  @Field({ nullable: true })
  refreshToken?: string;

  @Field(() => UserType, { nullable: true })
  user?: UserType;

  // Multi-institute path
  @Field({ nullable: true })
  requiresInstituteSelection?: boolean;

  @Field({ nullable: true })
  selectionToken?: string;

  @Field({ nullable: true })
  userId?: string;

  @Field(() => [MembershipInfo], { nullable: true })
  memberships?: MembershipInfo[];
}

@ObjectType()
export class SessionInfo {
  @Field()
  id!: string;

  @Field({ nullable: true })
  deviceInfo?: string;

  @Field({ nullable: true })
  ipAddress?: string;

  @Field({ nullable: true })
  userAgent?: string;

  @Field(() => DateTimeScalar, { nullable: true })
  lastUsedAt?: Date;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  expiresAt!: Date;

  @Field()
  isCurrent!: boolean;
}
