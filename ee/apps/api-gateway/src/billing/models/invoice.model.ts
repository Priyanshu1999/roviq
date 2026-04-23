import { Field, ID, ObjectType } from '@nestjs/graphql';
import { InvoiceStatus } from '@roviq/ee-billing-types';
import type { invoices } from '@roviq/ee-database';
import { DateTimeScalar, Paginated } from '@roviq/nestjs-graphql';
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

  @Field(() => DateTimeScalar, { nullable: true })
  periodStart!: Date | null;

  @Field(() => DateTimeScalar, { nullable: true })
  periodEnd!: Date | null;

  @Field(() => DateTimeScalar, { nullable: true })
  issuedAt!: Date | null;

  @Field(() => DateTimeScalar)
  dueAt!: Date;

  @Field(() => DateTimeScalar, { nullable: true })
  paidAt!: Date | null;

  @Field(() => GraphQLJSON, { nullable: true })
  lineItems!: unknown[] | null;

  @Field(() => GraphQLJSON, { nullable: true })
  taxBreakdown!: Record<string, unknown> | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;

  /**
   * UPI payment URI for direct P2P payment — built from reseller's UPI_DIRECT config VPA.
   * Null when invoice is already paid or reseller has no UPI_DIRECT gateway config.
   * Format: upi://pay?pa={vpa}&pn={resellerName}&am={amount}&tn=INV-{number}&cu=INR
   */
  @Field(() => String, { nullable: true })
  upiPaymentUri?: string | null;
}

@ObjectType()
export class InvoiceConnection extends Paginated(InvoiceModel) {}
