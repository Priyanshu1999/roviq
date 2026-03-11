import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class AuditLog {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

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

  @Field()
  createdAt!: Date;

  @Field(() => String, { nullable: true })
  actorName!: string | null;

  @Field(() => String, { nullable: true })
  userName!: string | null;

  @Field(() => String, { nullable: true })
  tenantName!: string | null;
}
