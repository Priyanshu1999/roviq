import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NovuModule } from '@novu/framework/nest';
import { TelemetryModule } from '@roviq/telemetry';
import { validate } from '../config/env.validation';
import { BillingNotificationController } from '../controllers/billing-notification.controller';
import { ApprovalListener } from '../listeners/approval.listener';
import { AttendanceListener } from '../listeners/attendance.listener';
import { AuthListener } from '../listeners/auth.listener';
import { FeeListener } from '../listeners/fee.listener';
import { SubscriberSyncListener } from '../listeners/subscriber-sync.listener';
import { UserListener } from '../listeners/user.listener';
import { NotificationServiceRepositoryModule } from '../repositories/notification-service-repository.module';
import { DeviceTokenService } from '../services/device-token.service';
import { NotificationTriggerService } from '../services/notification-trigger.service';
import { PreferenceLoaderService } from '../services/preference-loader.service';
import { SubscriberSyncService } from '../services/subscriber-sync.service';
import {
  approvalRequestWorkflow,
  attendanceAbsentWorkflow,
  billingEventWorkflow,
  feeOverdueWorkflow,
  systemAuthWorkflow,
  userWelcomeWorkflow,
} from '../workflows';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    TelemetryModule,
    NotificationServiceRepositoryModule,
    NovuModule.register({
      apiPath: '/api/novu',
      workflows: [
        systemAuthWorkflow,
        userWelcomeWorkflow,
        attendanceAbsentWorkflow,
        feeOverdueWorkflow,
        approvalRequestWorkflow,
        billingEventWorkflow,
      ],
    }),
  ],
  controllers: [
    AppController,
    BillingNotificationController,
    ApprovalListener,
    AttendanceListener,
    AuthListener,
    FeeListener,
    SubscriberSyncListener,
    UserListener,
  ],
  providers: [
    NotificationTriggerService,
    SubscriberSyncService,
    DeviceTokenService,
    PreferenceLoaderService,
  ],
})
export class AppModule {}
