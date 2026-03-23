import { Field, ID, InputType } from '@nestjs/graphql';
import { IsUUID } from 'class-validator';

@InputType()
export class ChangePlanInput {
  @Field(() => ID)
  @IsUUID('all')
  subscriptionId!: string;

  @Field(() => ID)
  @IsUUID('all')
  newPlanId!: string;
}
