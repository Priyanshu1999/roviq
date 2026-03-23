import { Field, ID, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID } from 'class-validator';

@InputType()
export class PauseSubscriptionInput {
  @Field(() => ID)
  @IsUUID('all')
  subscriptionId!: string;

  @Field({ nullable: true })
  @IsString()
  @IsOptional()
  reason?: string;
}
