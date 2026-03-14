import { Module } from '@nestjs/common';
import { auditDbProvider } from '../audit-db.provider';
import { AuditQueryPgRepository } from './audit-query.pg-repository';
import { AuditQueryRepository } from './audit-query.repository';
import { AuditWritePgRepository } from './audit-write.pg-repository';
import { AuditWriteRepository } from './audit-write.repository';

@Module({
  providers: [
    auditDbProvider,
    { provide: AuditQueryRepository, useClass: AuditQueryPgRepository },
    { provide: AuditWriteRepository, useClass: AuditWritePgRepository },
  ],
  exports: [AuditQueryRepository, AuditWriteRepository],
})
export class AuditRepositoryModule {}
