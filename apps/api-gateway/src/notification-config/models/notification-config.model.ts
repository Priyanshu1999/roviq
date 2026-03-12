import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NotificationConfigModel {
  @Field(() => ID)
  id!: string;

  @Field()
  tenantId!: string;

  @Field()
  notificationType!: string;

  @Field()
  inAppEnabled!: boolean;

  @Field()
  whatsappEnabled!: boolean;

  @Field()
  emailEnabled!: boolean;

  @Field()
  pushEnabled!: boolean;

  @Field()
  digestEnabled!: boolean;

  @Field({ nullable: true })
  digestCron?: string;
}
