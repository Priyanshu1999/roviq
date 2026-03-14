import { Module } from '@nestjs/common';
import { PrismaModule } from '@roviq/nestjs-prisma';
import { BillingReadPrismaRepository } from './billing-read.prisma-repository';
import { BillingReadRepository } from './billing-read.repository';
import { NotificationConfigReadPrismaRepository } from './notification-config-read.prisma-repository';
import { NotificationConfigReadRepository } from './notification-config-read.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: NotificationConfigReadRepository,
      useClass: NotificationConfigReadPrismaRepository,
    },
    {
      provide: BillingReadRepository,
      useClass: BillingReadPrismaRepository,
    },
  ],
  exports: [NotificationConfigReadRepository, BillingReadRepository],
})
export class NotificationServiceRepositoryModule {}
