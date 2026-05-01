import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AuditPartitionRepository } from './repositories/audit-partition.repository';

const MONTHS_AHEAD = 6;
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps audit_logs monthly partitions ahead of wall-clock time. Boot ensures
 * the current write succeeds; the daily timer covers pods that outlive a
 * month boundary. Mirrored by scripts/db-reset.ts for dev/test DBs — see the
 * partition-maintenance rule in the drizzle-database skill.
 */
@Injectable()
export class AuditPartitionMaintainer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditPartitionMaintainer.name);
  private dailyTimer: NodeJS.Timeout | null = null;

  constructor(private readonly partitions: AuditPartitionRepository) {}

  async onModuleInit(): Promise<void> {
    await this.partitions.ensureMonthsAhead(MONTHS_AHEAD);
    this.dailyTimer = setInterval(() => {
      void this.partitions.ensureMonthsAhead(MONTHS_AHEAD).catch((err) => {
        this.logger.error('Scheduled audit partition ensure failed', err);
      });
    }, DAILY_INTERVAL_MS);
    this.dailyTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.dailyTimer) {
      clearInterval(this.dailyTimer);
      this.dailyTimer = null;
    }
  }
}
