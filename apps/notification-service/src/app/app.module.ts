import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NovuModule } from '@novu/framework/nest';
import { PrismaModule } from '@roviq/nestjs-prisma';
import { TelemetryModule } from '@roviq/telemetry';
import { validate } from '../config/env.validation';
import { ApprovalListener } from '../listeners/approval.listener';
import { AttendanceListener } from '../listeners/attendance.listener';
import { AuthListener } from '../listeners/auth.listener';
import { FeeListener } from '../listeners/fee.listener';
import { SubscriberSyncListener } from '../listeners/subscriber-sync.listener';
import { NatsModule } from '../nats/nats.module';
import { DeviceTokenService } from '../services/device-token.service';
import { NotificationTriggerService } from '../services/notification-trigger.service';
import { PreferenceLoaderService } from '../services/preference-loader.service';
import { SubscriberSyncService } from '../services/subscriber-sync.service';
import {
  approvalRequestWorkflow,
  attendanceAbsentWorkflow,
  feeOverdueWorkflow,
  systemAuthWorkflow,
} from '../workflows';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    TelemetryModule,
    PrismaModule,
    NatsModule,
    NovuModule.register({
      apiPath: '/api/novu',
      workflows: [
        systemAuthWorkflow,
        attendanceAbsentWorkflow,
        feeOverdueWorkflow,
        approvalRequestWorkflow,
      ],
    }),
  ],
  controllers: [AppController],
  providers: [
    NotificationTriggerService,
    SubscriberSyncService,
    DeviceTokenService,
    PreferenceLoaderService,
    AttendanceListener,
    FeeListener,
    ApprovalListener,
    AuthListener,
    SubscriberSyncListener,
  ],
})
export class AppModule {}
