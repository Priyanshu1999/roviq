import { Field, ID, ObjectType } from '@nestjs/graphql';
import { SubscriptionStatus } from '@roviq/ee-billing-types';
import { Paginated } from '@roviq/nestjs-graphql';
import { InstituteRef } from './institute-ref.model';
import { SubscriptionPlanModel } from './subscription-plan.model';

@ObjectType()
export class SubscriptionModel {
  @Field(() => ID)
  id!: string;

  @Field()
  instituteId!: string;

  @Field()
  planId!: string;

  @Field(() => InstituteRef, { nullable: true })
  institute?: InstituteRef;

  @Field(() => SubscriptionPlanModel, { nullable: true })
  plan?: SubscriptionPlanModel;

  @Field(() => SubscriptionStatus)
  status!: SubscriptionStatus;

  @Field({ nullable: true })
  providerSubscriptionId?: string;

  @Field({ nullable: true })
  providerCustomerId?: string;

  @Field({ nullable: true })
  currentPeriodStart?: Date;

  @Field({ nullable: true })
  currentPeriodEnd?: Date;

  @Field({ nullable: true })
  canceledAt?: Date;

  @Field({ nullable: true })
  trialEndsAt?: Date;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType()
export class SubscriptionConnection extends Paginated(SubscriptionModel) {}
