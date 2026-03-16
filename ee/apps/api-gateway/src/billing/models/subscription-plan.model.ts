import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import type { I18nContent } from '@roviq/database';
import { BillingInterval, type FeatureLimits, PlanStatus } from '@roviq/ee-billing-types';
import { I18nTextScalar } from '@roviq/nestjs-graphql';
import { GraphQLJSON } from 'graphql-type-json';

@ObjectType()
export class SubscriptionPlanModel {
  @Field(() => ID)
  id!: string;

  @Field(() => I18nTextScalar)
  name!: I18nContent;

  @Field(() => I18nTextScalar, { nullable: true })
  description?: I18nContent;

  @Field(() => Int)
  amount!: number;

  @Field()
  currency!: string;

  @Field(() => BillingInterval)
  billingInterval!: BillingInterval;

  @Field(() => GraphQLJSON)
  featureLimits!: FeatureLimits;

  @Field(() => PlanStatus)
  status!: PlanStatus;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
