import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RegisterDeviceTokenInput {
  @Field()
  token!: string;
}
