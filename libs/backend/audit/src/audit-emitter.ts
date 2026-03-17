import type { ClientProxy } from '@nestjs/microservices';

export interface AuditEvent {
  tenantId: string;
  userId: string;
  actorId: string;
  impersonatorId?: string;
  action: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'ASSIGN' | 'REVOKE';
  entityType: string;
  entityId?: string;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  source: string;
}

export function emitAuditEvent(client: ClientProxy, event: AuditEvent): void {
  // Headers (correlation-id, tenant-id, actor-id) are auto-injected
  // by JetStreamClient from AsyncLocalStorage — no explicit params needed.
  client.emit('AUDIT.log', event);
}
