import { Module } from '@nestjs/common';
import { AuditModule as AuditLibModule } from '@roviq/audit';
import { AuditConsumer } from './audit.consumer';
import { AuditInterceptor } from './audit.interceptor';
import { AuditResolver } from './audit.resolver';
import { AuditService } from './audit.service';
import { auditDbProvider } from './audit-db.provider';
import { natsProvider } from './nats.provider';
import { AuditRepositoryModule } from './repositories/audit-repository.module';

@Module({
  imports: [AuditRepositoryModule, AuditLibModule],
  providers: [
    natsProvider,
    auditDbProvider,
    AuditConsumer,
    AuditResolver,
    AuditService,
    AuditInterceptor,
  ],
  exports: [AuditInterceptor],
})
export class AuditModule {}
