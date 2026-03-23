import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { BillingInterval, PlanStatus } from '@roviq/ee-billing-types';
import type { plans } from '@roviq/ee-database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { GraphQLBigInt } from 'graphql-scalars';
import { GraphQLJSON } from 'graphql-type-json';

type PlanRow = typeof plans.$inferSelect;

@ObjectType()
export class SubscriptionPlanModel {
  @Field(() => ID)
  id!: string;

  @Field(() => I18nTextScalar)
  name!: I18nContent;

  @Field(() => I18nTextScalar, { nullable: true })
  description?: I18nContent | null;

  @Field(() => GraphQLBigInt)
  amount!: bigint;

  @Field()
  currency!: string;

  @Field(() => BillingInterval)
  interval!: PlanRow['interval'];

  @Field(() => GraphQLJSON)
  entitlements!: PlanRow['entitlements'];

  @Field(() => PlanStatus)
  status!: PlanRow['status'];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
