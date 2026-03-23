import { Field, ID, ObjectType } from '@nestjs/graphql';
import { InvoiceStatus } from '@roviq/ee-billing-types';
import type { invoices } from '@roviq/ee-database';
import { Paginated } from '@roviq/nestjs-graphql';
import { GraphQLBigInt } from 'graphql-scalars';
import { GraphQLJSON } from 'graphql-type-json';
import { InstituteRef } from './institute-ref.model';

type InvoiceRow = typeof invoices.$inferSelect;

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
  tenantId!: string;

  @Field()
  subscriptionId!: string;

  @Field()
  resellerId!: string;

  @Field()
  invoiceNumber!: string;

  @Field(() => SubscriptionRef, { nullable: true })
  subscription?: SubscriptionRef;

  @Field(() => GraphQLBigInt)
  subtotalAmount!: bigint;

  @Field(() => GraphQLBigInt)
  taxAmount!: bigint;

  @Field(() => GraphQLBigInt)
  totalAmount!: bigint;

  @Field(() => GraphQLBigInt)
  paidAmount!: bigint;

  @Field()
  currency!: string;

  @Field(() => InvoiceStatus)
  status!: InvoiceRow['status'];

  @Field(() => Date, { nullable: true })
  periodStart!: Date | null;

  @Field(() => Date, { nullable: true })
  periodEnd!: Date | null;

  @Field(() => Date, { nullable: true })
  issuedAt!: Date | null;

  @Field()
  dueAt!: Date;

  @Field(() => Date, { nullable: true })
  paidAt!: Date | null;

  @Field(() => GraphQLJSON, { nullable: true })
  lineItems!: unknown[] | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class InvoiceConnection extends Paginated(InvoiceModel) {}
