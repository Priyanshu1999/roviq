import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GatewayConfigStatus } from '@roviq/ee-billing-types';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * GraphQL output type for payment gateway configs.
 * NEVER includes credentials or webhookSecret — those are encrypted at rest
 * and only decrypted inside PaymentGatewayFactory.
 */
@ObjectType()
export class PaymentGatewayConfigModel {
  @Field(() => ID)
  id!: string;

  @Field()
  resellerId!: string;

  @Field()
  provider!: string;

  @Field(() => GatewayConfigStatus)
  status!: string;

  @Field(() => String, { nullable: true })
  displayName!: string | null;

  @Field()
  isDefault!: boolean;

  @Field()
  testMode!: boolean;

  @Field(() => GraphQLJSON)
  supportedMethods!: string[];

  /** Computed: https://api.roviq.com/webhooks/{provider}/{resellerId}. Null for UPI_DIRECT. */
  @Field(() => String, { nullable: true })
  webhookUrl!: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
