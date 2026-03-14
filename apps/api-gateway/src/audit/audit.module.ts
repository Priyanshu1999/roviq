import { Module } from '@nestjs/common';
import { AuditConsumer } from './audit.consumer';
import { AuditResolver } from './audit.resolver';
import { AuditService } from './audit.service';
import { natsProvider } from './nats.provider';
import { AuditRepositoryModule } from './repositories/audit-repository.module';

@Module({
  imports: [AuditRepositoryModule],
  providers: [natsProvider, AuditConsumer, AuditResolver, AuditService],
  exports: [natsProvider],
})
export class AuditModule {}
