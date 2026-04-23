import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { BillingInterval, PlanStatus } from '@roviq/ee-billing-types';
import type { plans } from '@roviq/ee-database';
import { DateTimeScalar, I18nTextScalar } from '@roviq/nestjs-graphql';
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

  /** Number of free trial days before billing starts (0 = no trial) */
  @Field(() => Int, { defaultValue: 0 })
  trialDays!: number;

  /** Display order in plan listing — lower numbers appear first */
  @Field(() => Int, { nullable: true })
  sortOrder?: number | null;

  @Field(() => PlanStatus)
  status!: PlanRow['status'];

  /** Number of active/trialing/paused subscriptions using this plan — resolved via DataLoader */
  @Field(() => Int, { nullable: true })
  subscriberCount?: number | null;

  @Field(() => Int, { description: 'Optimistic concurrency version counter' })
  version!: number;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  @Field(() => DateTimeScalar)
  updatedAt!: Date;
}
