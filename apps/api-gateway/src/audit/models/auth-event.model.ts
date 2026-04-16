import { Field, ID, ObjectType } from '@nestjs/graphql';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class AuthEventModel {
  @Field(() => ID)
  id!: string;

  @Field(() => String, { nullable: true })
  userId?: string | null;

  @Field()
  eventType!: string;

  @Field(() => String, { nullable: true })
  scope?: string | null;

  @Field(() => String, { nullable: true })
  tenantId?: string | null;

  @Field(() => String, { nullable: true })
  resellerId?: string | null;

  @Field(() => String, { nullable: true })
  authMethod?: string | null;

  @Field(() => String, { nullable: true })
  ipAddress?: string | null;

  @Field(() => String, { nullable: true })
  userAgent?: string | null;

  @Field(() => String, { nullable: true })
  failureReason?: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata?: Record<string, unknown> | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;
}
