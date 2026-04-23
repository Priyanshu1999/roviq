import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PaymentMethod, PaymentStatus } from '@roviq/ee-billing-types';
import type { payments } from '@roviq/ee-database';
import { DateTimeScalar } from '@roviq/nestjs-graphql';
import { GraphQLBigInt } from 'graphql-scalars';

type PaymentRow = typeof payments.$inferSelect;

@ObjectType()
export class PaymentModel {
  @Field(() => ID)
  id!: string;

  @Field()
  invoiceId!: string;

  @Field()
  tenantId!: string;

  @Field(() => PaymentStatus)
  status!: PaymentRow['status'];

  @Field(() => PaymentMethod)
  method!: PaymentRow['method'];

  @Field(() => GraphQLBigInt)
  amountPaise!: bigint;

  @Field()
  currency!: string;

  @Field()
  resellerId!: string;

  @Field(() => String, { nullable: true })
  gatewayProvider!: string | null;

  @Field(() => String, { nullable: true })
  gatewayPaymentId!: string | null;

  @Field(() => String, { nullable: true })
  gatewayOrderId!: string | null;

  @Field(() => String, { nullable: true })
  receiptNumber!: string | null;

  @Field(() => GraphQLBigInt, { nullable: true })
  refundedAmountPaise!: bigint | null;

  @Field(() => DateTimeScalar, { nullable: true })
  refundedAt!: Date | null;

  @Field(() => String, { nullable: true })
  refundReason!: string | null;

  @Field(() => String, { nullable: true })
  refundGatewayId!: string | null;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => DateTimeScalar, { nullable: true })
  paidAt!: Date | null;

  @Field(() => DateTimeScalar, { nullable: true })
  failedAt!: Date | null;

  @Field(() => String, { nullable: true })
  failureReason!: string | null;

  // --- UPI P2P verification fields ---

  /** UTR reference number submitted by the institute */
  @Field(() => String, { nullable: true })
  utrNumber!: string | null;

  /** Verification state: PENDING_VERIFICATION, VERIFIED, REJECTED, EXPIRED */
  @Field(() => String, { nullable: true })
  verificationStatus!: string | null;

  /** 24h deadline after UTR submission — auto-expires if unverified */
  @Field(() => DateTimeScalar, { nullable: true })
  verificationDeadline!: Date | null;

  /** When the reseller verified the UTR */
  @Field(() => DateTimeScalar, { nullable: true })
  verifiedAt!: Date | null;

  /** Reseller membership ID that verified the UTR */
  @Field(() => String, { nullable: true })
  verifiedById!: string | null;

  // --- Cash collection fields ---

  /** Field agent membership ID that collected cash */
  @Field(() => String, { nullable: true })
  collectedById!: string | null;

  /** Date cash was physically collected (may differ from recording date) */
  @Field(() => String, { nullable: true })
  collectionDate!: string | null;

  @Field(() => DateTimeScalar)
  createdAt!: Date;
}
