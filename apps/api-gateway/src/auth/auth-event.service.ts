import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuthScope } from '@roviq/common-types';
import { authEvents, DRIZZLE_DB, type DrizzleDB, mkAdminCtx, withAdmin } from '@roviq/database';

export type AuthEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'token_refresh'
  | 'institute_switch'
  | 'impersonation_start'
  | 'impersonation_end'
  | 'all_sessions_revoked'
  | 'password_change'
  | 'passkey_register'
  | 'account_locked';

export interface AuthEventInput {
  userId?: string;
  type: AuthEventType;
  scope?: AuthScope;
  tenantId?: string;
  resellerId?: string;
  authMethod?: string;
  ip?: string;
  userAgent?: string;
  deviceInfo?: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuthEventService {
  private readonly logger = new Logger(AuthEventService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {}

  async emit(event: AuthEventInput): Promise<void> {
    try {
      await withAdmin(this.db, mkAdminCtx('consumer:auth-event.service'), async (tx) => {
        await tx.insert(authEvents).values({
          userId: event.userId,
          eventType: event.type,
          scope: event.scope,
          tenantId: event.tenantId,
          resellerId: event.resellerId,
          authMethod: event.authMethod,
          ipAddress: event.ip,
          userAgent: event.userAgent,
          deviceInfo: event.deviceInfo,
          failureReason: event.failureReason,
          metadata: event.metadata ?? {},
        });
      });
    } catch (error) {
      this.logger.warn(`Failed to emit auth event [${event.type}]: ${error}`);
    }
  }
}
