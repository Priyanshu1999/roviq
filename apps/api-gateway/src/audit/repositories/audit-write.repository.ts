import type { AuditEventData } from './types';

export abstract class AuditWriteRepository {
  abstract batchInsert(events: AuditEventData[]): Promise<void>;
}
