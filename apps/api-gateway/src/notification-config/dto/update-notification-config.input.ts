import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsDefined, IsNotEmpty, IsOptional, IsString } from 'class-validator';

@InputType({ description: 'Enable/disable delivery channels for a specific notification type.' })
export class UpdateNotificationConfigInput {
  @IsString()
  @IsNotEmpty()
  @IsDefined()
  @Field({
    description:
      'Notification type key, e.g. "FEE_REMINDER", "ATTENDANCE_ALERT". Must match a registered Novu event slug.',
  })
  notificationType!: string;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    description: 'Whether to show this notification as an in-app bell/feed notification.',
  })
  inAppEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true, description: 'Whether to deliver this notification via WhatsApp.' })
  whatsappEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({ nullable: true, description: 'Whether to deliver this notification via email.' })
  emailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    description: 'Whether to deliver this notification via push (FCM/APNS).',
  })
  pushEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  @Field({
    nullable: true,
    description:
      'Whether to batch and deliver this notification as a daily/weekly digest instead of immediately.',
  })
  digestEnabled?: boolean;

  @IsString()
  @IsOptional()
  @Field({
    nullable: true,
    description:
      'Cron expression controlling digest delivery schedule, e.g. "0 8 * * *" for 08:00 daily.',
  })
  digestCron?: string;
}
