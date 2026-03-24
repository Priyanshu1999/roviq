import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PaymentMethod, PaymentStatus } from '@roviq/ee-billing-types';
import type { payments } from '@roviq/ee-database';
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

  @Field(() => String, { nullable: true })
  gatewayProvider!: string | null;

  @Field(() => String, { nullable: true })
  gatewayPaymentId!: string | null;

  @Field(() => String, { nullable: true })
  receiptNumber!: string | null;

  @Field(() => Date, { nullable: true })
  paidAt!: Date | null;

  @Field(() => Date, { nullable: true })
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
  @Field(() => Date, { nullable: true })
  verificationDeadline!: Date | null;

  /** When the reseller verified the UTR */
  @Field(() => Date, { nullable: true })
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

  @Field()
  createdAt!: Date;
}
