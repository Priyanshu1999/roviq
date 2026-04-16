import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class AuditLog {
  @Field(() => ID)
  id!: string;

  /** NULL for platform and reseller-scoped actions */
  @Field(() => String, { nullable: true })
  tenantId!: string | null;

  @Field()
  userId!: string;

  @Field()
  actorId!: string;

  @Field(() => String, { nullable: true })
  impersonatorId!: string | null;

  @Field()
  action!: string;

  @Field()
  actionType!: string;

  @Field()
  entityType!: string;

  @Field(() => String, { nullable: true })
  entityId!: string | null;

  @Field(() => GraphQLJSON, { nullable: true })
  changes!: Record<string, unknown> | null;

  @Field(() => GraphQLJSON, { nullable: true })
  metadata!: Record<string, unknown> | null;

  @Field()
  correlationId!: string;

  @Field(() => String, { nullable: true })
  ipAddress!: string | null;

  @Field(() => String, { nullable: true })
  userAgent!: string | null;

  @Field()
  source!: string;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => String, { nullable: true })
  actorName!: string | null;

  @Field(() => String, { nullable: true })
  userName!: string | null;

  @Field(() => I18nTextScalar, { nullable: true })
  tenantName!: I18nContent | null;
}
