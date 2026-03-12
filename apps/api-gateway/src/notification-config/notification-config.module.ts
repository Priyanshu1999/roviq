import { Module } from '@nestjs/common';
import { NotificationConfigResolver } from './notification-config.resolver';
import { NotificationConfigService } from './notification-config.service';

@Module({
  providers: [NotificationConfigService, NotificationConfigResolver],
})
export class NotificationConfigModule {}
