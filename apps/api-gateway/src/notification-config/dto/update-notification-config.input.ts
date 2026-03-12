import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateNotificationConfigInput {
  @Field()
  notificationType!: string;

  @Field({ nullable: true })
  inAppEnabled?: boolean;

  @Field({ nullable: true })
  whatsappEnabled?: boolean;

  @Field({ nullable: true })
  emailEnabled?: boolean;

  @Field({ nullable: true })
  pushEnabled?: boolean;

  @Field({ nullable: true })
  digestEnabled?: boolean;

  @Field({ nullable: true })
  digestCron?: string;
}
