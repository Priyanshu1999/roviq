import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString, IsUUID, Length } from 'class-validator';

@InputType()
export class SubmitUpiProofInput {
  @Field(() => ID)
  @IsUUID('all')
  invoiceId!: string;

  /** 12–22 digit UTR reference number from the institute's UPI app */
  @Field()
  @IsString()
  @Length(12, 22)
  utrNumber!: string;
}
