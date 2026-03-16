import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { InvoiceStatus } from '@roviq/ee-billing-types';
import { Paginated } from '@roviq/nestjs-graphql';
import { InstituteRef } from './institute-ref.model';

@ObjectType()
export class SubscriptionRef {
  @Field(() => ID)
  id!: string;

  @Field(() => InstituteRef, { nullable: true })
  institute?: InstituteRef;
}

@ObjectType()
export class InvoiceModel {
  @Field(() => ID)
  id!: string;

  @Field()
  subscriptionId!: string;

  @Field()
  instituteId!: string;

  @Field(() => SubscriptionRef, { nullable: true })
  subscription?: SubscriptionRef;

  @Field(() => Int)
  amount!: number;

  @Field()
  currency!: string;

  @Field(() => InvoiceStatus)
  status!: InvoiceStatus;

  @Field({ nullable: true })
  providerInvoiceId?: string;

  @Field({ nullable: true })
  providerPaymentId?: string;

  @Field()
  billingPeriodStart!: Date;

  @Field()
  billingPeriodEnd!: Date;

  @Field({ nullable: true })
  paidAt?: Date;

  @Field()
  dueDate!: Date;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class InvoiceConnection extends Paginated(InvoiceModel) {}
