import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

@InputType({
  description: 'FCM/APNS device token for registering push notification delivery to a user device.',
})
export class RegisterDeviceTokenInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  @Field({
    description:
      'Firebase Cloud Messaging (FCM) or APNS device token. Tokens are rotated by the OS — clients should re-register on each session.',
  })
  token!: string;
}
