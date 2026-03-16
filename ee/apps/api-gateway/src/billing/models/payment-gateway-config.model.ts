import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GatewayConfigStatus } from '@roviq/ee-billing-types';

@ObjectType()
export class PaymentGatewayConfigModel {
  @Field(() => ID)
  id!: string;

  @Field()
  instituteId!: string;

  @Field()
  provider!: string;

  @Field(() => GatewayConfigStatus)
  status!: GatewayConfigStatus;

  @Field()
  createdAt!: Date;
}
