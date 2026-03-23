import { Logger as NestLogger } from '@nestjs/common';
import type { Logger as DrizzleLogger } from 'drizzle-orm';

export class RoviqDrizzleLogger implements DrizzleLogger {
  private readonly logger = new NestLogger('Drizzle');

  logQuery(query: string, params: unknown[]): void {
    this.logger.debug(
      `${query} -- params: ${JSON.stringify(params, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))}`,
    );
  }
}
