import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, IsUUID } from 'class-validator';

@InputType()
export class RejectUpiInput {
  @Field(() => ID)
  @IsUUID('all')
  paymentId!: string;

  /** Reason for rejecting the UPI proof — shown to institute for clarity */
  @Field()
  @IsString()
  reason!: string;
}
