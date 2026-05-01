import { Module } from '@nestjs/common';
import { DatabaseModule } from '@roviq/database';
import { AuditPartitionDrizzleRepository } from './audit-partition.drizzle-repository';
import { AuditPartitionRepository } from './audit-partition.repository';
import { AuditQueryDrizzleRepository } from './audit-query.drizzle-repository';
import { AuditQueryRepository } from './audit-query.repository';
import { AuditWriteDrizzleRepository } from './audit-write.drizzle-repository';
import { AuditWriteRepository } from './audit-write.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    { provide: AuditQueryRepository, useClass: AuditQueryDrizzleRepository },
    { provide: AuditWriteRepository, useClass: AuditWriteDrizzleRepository },
    { provide: AuditPartitionRepository, useClass: AuditPartitionDrizzleRepository },
  ],
  exports: [AuditQueryRepository, AuditWriteRepository, AuditPartitionRepository],
})
export class AuditRepositoryModule {}
