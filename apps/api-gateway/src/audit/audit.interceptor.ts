import type { NatsConnection } from '@nats-io/nats-core';
import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { type AuditEvent, emitAuditEvent, NoAudit } from '@roviq/audit';
import { catchError, type Observable, tap } from 'rxjs';
import { NATS_CONNECTION } from './nats.provider';

type ActionType = AuditEvent['actionType'];

const ACTION_PREFIX_MAP: Record<string, ActionType> = {
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
  restore: 'RESTORE',
  assign: 'ASSIGN',
  revoke: 'REVOKE',
};

function extractActionMeta(fieldName: string): { type: ActionType; entity: string } {
  for (const [prefix, type] of Object.entries(ACTION_PREFIX_MAP)) {
    if (fieldName.startsWith(prefix)) {
      return { type, entity: fieldName.slice(prefix.length) };
    }
  }
  return { type: 'UPDATE', entity: fieldName };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<GqlContextType>() !== 'graphql') {
      return next.handle();
    }

    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();

    if (info.parentType.name !== 'Mutation') {
      return next.handle();
    }

    const noAudit = this.reflector.get(NoAudit, context.getHandler());
    if (noAudit) {
      return next.handle();
    }

    const req = gqlContext.getContext().req;
    const user = req.user;
    if (!user) {
      return next.handle();
    }

    const correlationId = req.correlationId;
    const actionMeta = extractActionMeta(info.fieldName);

    return next.handle().pipe(
      tap({
        next: (result) => {
          void emitAuditEvent(
            this.nc,
            {
              tenantId: user.tenantId,
              userId: user.userId,
              actorId: user.userId,
              impersonatorId: undefined,
              action: info.fieldName,
              actionType: actionMeta.type,
              entityType: actionMeta.entity,
              entityId: (result as Record<string, unknown>)?.id as string | undefined,
              changes: null,
              metadata: { args: gqlContext.getArgs() },
              ipAddress: req.ip,
              userAgent: req.headers?.['user-agent'],
              source: 'GATEWAY',
            },
            correlationId,
          ).catch((err) => {
            this.logger.error('Audit emit failed', err);
          });
        },
      }),
      catchError((err) => {
        void emitAuditEvent(
          this.nc,
          {
            tenantId: user.tenantId,
            userId: user.userId,
            actorId: user.userId,
            impersonatorId: undefined,
            action: info.fieldName,
            actionType: actionMeta.type,
            entityType: actionMeta.entity,
            entityId: undefined,
            changes: null,
            metadata: {
              error: err instanceof Error ? err.message : String(err),
              errorName: err instanceof Error ? err.name : undefined,
              args: gqlContext.getArgs(),
              failed: true,
            },
            ipAddress: req.ip,
            userAgent: req.headers?.['user-agent'],
            source: 'GATEWAY',
          },
          correlationId,
        ).catch((auditErr) => {
          this.logger.error('Failed mutation audit emit failed', auditErr);
        });
        throw err;
      }),
    );
  }
}
