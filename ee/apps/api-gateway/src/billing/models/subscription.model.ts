import { Field, ID, ObjectType } from '@nestjs/graphql';
import { SubscriptionStatus } from '@roviq/ee-billing-types';
import type { subscriptions } from '@roviq/ee-database';
import { Paginated } from '@roviq/nestjs-graphql';
import { InstituteRef } from './institute-ref.model';
import { SubscriptionPlanModel } from './subscription-plan.model';

type SubscriptionRow = typeof subscriptions.$inferSelect;

@ObjectType()
export class SubscriptionModel {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  planId!: string;

  @Field()
  resellerId!: string;

  @Field(() => InstituteRef, { nullable: true })
  institute?: InstituteRef;

  @Field(() => SubscriptionPlanModel, { nullable: true })
  plan?: SubscriptionPlanModel;

  @Field(() => SubscriptionStatus)
  status!: SubscriptionRow['status'];

  @Field(() => String, { nullable: true })
  gatewaySubscriptionId!: string | null;

  @Field(() => String, { nullable: true })
  gatewayProvider!: string | null;

  @Field(() => Date, { nullable: true })
  currentPeriodStart!: Date | null;

  @Field(() => Date, { nullable: true })
  currentPeriodEnd!: Date | null;

  @Field(() => Date, { nullable: true })
  cancelledAt!: Date | null;

  /** Reason provided when subscription was cancelled */
  @Field(() => String, { nullable: true })
  cancelReason!: string | null;

  /** When the subscription was paused by the reseller */
  @Field(() => Date, { nullable: true })
  pausedAt!: Date | null;

  /** Reason provided when subscription was paused */
  @Field(() => String, { nullable: true })
  pauseReason!: string | null;

  @Field(() => Date, { nullable: true })
  trialEndsAt!: Date | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class SubscriptionConnection extends Paginated(SubscriptionModel) {}
