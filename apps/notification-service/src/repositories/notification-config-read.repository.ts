import type { NotificationConfigRecord } from './types';

export abstract class NotificationConfigReadRepository {
  abstract findByTenantAndType(
    tenantId: string,
    notificationType: string,
  ): Promise<NotificationConfigRecord | null>;
}
