import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { ClientProxy } from '@nestjs/microservices';
import { type AuditEvent, emitAuditEvent, NoAudit } from '@roviq/audit';
import { catchError, type Observable, tap } from 'rxjs';

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
  constructor(
    private readonly reflector: Reflector,
    @Inject('JETSTREAM_CLIENT') private readonly client: ClientProxy,
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

    const actionMeta = extractActionMeta(info.fieldName);

    return next.handle().pipe(
      tap({
        next: (result) => {
          emitAuditEvent(this.client, {
            tenantId: user.tenantId,
            userId: user.userId,
            actorId: user.userId,
            impersonatorId: user.impersonatorId,
            action: info.fieldName,
            actionType: actionMeta.type,
            entityType: actionMeta.entity,
            entityId: (result as Record<string, unknown>)?.id as string | undefined,
            changes: null,
            metadata: { args: gqlContext.getArgs() },
            ipAddress: req.ip,
            userAgent: req.headers?.['user-agent'],
            source: 'GATEWAY',
          });
        },
      }),
      catchError((err) => {
        emitAuditEvent(this.client, {
          tenantId: user.tenantId,
          userId: user.userId,
          actorId: user.userId,
          impersonatorId: user.impersonatorId,
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
        });
        throw err;
      }),
    );
  }
}
