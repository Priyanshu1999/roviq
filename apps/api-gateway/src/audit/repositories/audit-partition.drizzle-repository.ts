import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, withAdmin } from '@roviq/database';
import { sql } from 'drizzle-orm';
import { AuditPartitionRepository } from './audit-partition.repository';

@Injectable()
export class AuditPartitionDrizzleRepository extends AuditPartitionRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  // withAdmin sets ROLE roviq_admin; ensure_monthly_partition is SECURITY
  // DEFINER + GRANT EXECUTE TO roviq_admin so the partition DDL runs as the
  // function's superuser owner without giving the runtime role any extra
  // privileges. See migration 20260501033334 + drizzle-database skill.
  async ensureMonthsAhead(monthsAhead: number): Promise<void> {
    await withAdmin(this.db, async (tx) => {
      await tx.execute(sql`
        SELECT ensure_monthly_partition('audit_logs'::regclass, gs)
        FROM generate_series(
          date_trunc('month', NOW()),
          date_trunc('month', NOW()) + (${monthsAhead} || ' months')::interval,
          interval '1 month'
        ) AS gs
      `);
    });
  }
}
