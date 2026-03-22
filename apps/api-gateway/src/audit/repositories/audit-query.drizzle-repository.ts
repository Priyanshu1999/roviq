import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  auditLogs,
  authEvents,
  DRIZZLE_DB,
  type DrizzleDB,
  institutes,
  users,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { and, count, desc, eq, gte, inArray, lte, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { AuditQueryRepository, type AuthEventRow } from './audit-query.repository';
import type { AuditLogQueryResult, AuditLogRow, FindAuditLogsParams } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeCursor(cursor: string): { timestamp: string; id: string } {
  const decoded = Buffer.from(cursor, 'base64url').toString();
  const separatorIndex = decoded.lastIndexOf(':');
  if (separatorIndex === -1) {
    throw new BadRequestException('Invalid cursor format');
  }
  const timestamp = decoded.slice(0, separatorIndex);
  const id = decoded.slice(separatorIndex + 1);
  if (Number.isNaN(Date.parse(timestamp)) || !UUID_RE.test(id)) {
    throw new BadRequestException('Invalid cursor format');
  }
  return { timestamp, id };
}

@Injectable()
export class AuditQueryDrizzleRepository extends AuditQueryRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findAuditLogs(params: FindAuditLogsParams): Promise<AuditLogQueryResult> {
    const { tenantId, filter, first, after } = params;

    // Platform admins (no tenantId) see all audit logs via withAdmin
    const runInContext = tenantId
      ? (
          fn: (tx: Parameters<Parameters<typeof withTenant>[2]>[0]) => Promise<AuditLogQueryResult>,
        ) => withTenant(this.db, tenantId, fn)
      : (
          fn: (tx: Parameters<Parameters<typeof withAdmin>[1]>[0]) => Promise<AuditLogQueryResult>,
        ) => withAdmin(this.db, fn);

    return runInContext(async (tx) => {
      const conditions: SQL[] = [];

      // Defense-in-depth: explicit tenant filter alongside RLS (skip for platform admins)
      if (tenantId) {
        conditions.push(eq(auditLogs.tenantId, tenantId));
      }

      // Cursor: base64url("timestamp:uuid") → WHERE (created_at, id) < ($N, $N)
      if (after) {
        const { timestamp, id } = decodeCursor(after);
        conditions.push(
          sql`(${auditLogs.createdAt}, ${auditLogs.id}) < (${timestamp}::timestamptz, ${id}::uuid)`,
        );
      }

      if (filter?.entityType) {
        conditions.push(eq(auditLogs.entityType, filter.entityType));
      }
      if (filter?.entityId) {
        conditions.push(eq(auditLogs.entityId, filter.entityId));
      }
      if (filter?.userId) {
        conditions.push(eq(auditLogs.userId, filter.userId));
      }
      if (filter?.actionTypes?.length) {
        conditions.push(inArray(auditLogs.actionType, filter.actionTypes));
      }
      if (filter?.correlationId) {
        conditions.push(eq(auditLogs.correlationId, filter.correlationId));
      }
      if (filter?.dateRange) {
        conditions.push(gte(auditLogs.createdAt, filter.dateRange.from));
        conditions.push(lte(auditLogs.createdAt, filter.dateRange.to));
      }

      const whereClause = and(...conditions);

      // Aliases for actor and user JOINs (both reference the users table)
      const actor = alias(users, 'actor');
      const userAlias = alias(users, 'u');

      // Fetch first+1 to determine hasNextPage, with actor/user/institute names via LEFT JOIN
      const [dataRows, countRows] = await Promise.all([
        tx
          .select({
            id: auditLogs.id,
            scope: auditLogs.scope,
            tenantId: auditLogs.tenantId,
            resellerId: auditLogs.resellerId,
            userId: auditLogs.userId,
            actorId: auditLogs.actorId,
            impersonatorId: auditLogs.impersonatorId,
            impersonationSessionId: auditLogs.impersonationSessionId,
            action: auditLogs.action,
            actionType: auditLogs.actionType,
            entityType: auditLogs.entityType,
            entityId: auditLogs.entityId,
            changes: auditLogs.changes,
            metadata: auditLogs.metadata,
            correlationId: auditLogs.correlationId,
            ipAddress: auditLogs.ipAddress,
            userAgent: auditLogs.userAgent,
            source: auditLogs.source,
            createdAt: auditLogs.createdAt,
            actorName: actor.username,
            userName: userAlias.username,
            tenantName: institutes.name,
          })
          .from(auditLogs)
          .leftJoin(actor, eq(actor.id, auditLogs.actorId))
          .leftJoin(userAlias, eq(userAlias.id, auditLogs.userId))
          .leftJoin(institutes, eq(institutes.id, auditLogs.tenantId))
          .where(whereClause)
          .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
          .limit(first + 1),
        tx.select({ total: count() }).from(auditLogs).where(whereClause),
      ]);

      const hasNextPage = dataRows.length > first;
      const rows = dataRows.slice(0, first);
      const totalCount = countRows[0]?.total ?? 0;

      const edges = rows.map((row) => ({
        cursor: Buffer.from(`${row.createdAt.toISOString()}:${row.id}`).toString('base64url'),
        node: this.mapRow(row),
      }));

      return {
        edges,
        totalCount,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!after,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
        },
      };
    });
  }

  async findAuthEvents(tenantId: string | undefined, first: number): Promise<AuthEventRow[]> {
    const runInContext = tenantId
      ? (fn: (tx: DrizzleDB) => Promise<AuthEventRow[]>) => withTenant(this.db, tenantId, fn)
      : (fn: (tx: DrizzleDB) => Promise<AuthEventRow[]>) => withAdmin(this.db, fn);

    return runInContext(async (tx) => {
      const conditions: SQL[] = [];
      if (tenantId) {
        conditions.push(eq(authEvents.tenantId, tenantId));
      }

      const rows = await tx
        .select()
        .from(authEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(authEvents.createdAt))
        .limit(first);

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        eventType: row.eventType,
        scope: row.scope,
        tenantId: row.tenantId,
        resellerId: row.resellerId,
        authMethod: row.authMethod,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        failureReason: row.failureReason,
        metadata: row.metadata as Record<string, unknown> | null,
        createdAt: row.createdAt,
      }));
    });
  }

  private mapRow(row: {
    id: string;
    scope: string;
    tenantId: string | null;
    resellerId: string | null;
    userId: string;
    actorId: string;
    impersonatorId: string | null;
    impersonationSessionId: string | null;
    action: string;
    actionType: string;
    entityType: string;
    entityId: string | null;
    changes: unknown;
    metadata: unknown;
    correlationId: string;
    ipAddress: string | null;
    userAgent: string | null;
    source: string;
    createdAt: Date;
    actorName: string | null;
    userName: string | null;
    tenantName: Record<string, string> | null;
  }): AuditLogRow {
    return {
      id: row.id,
      scope: row.scope,
      tenantId: row.tenantId,
      resellerId: row.resellerId,
      userId: row.userId,
      actorId: row.actorId,
      impersonatorId: row.impersonatorId,
      impersonationSessionId: row.impersonationSessionId,
      action: row.action,
      actionType: row.actionType,
      entityType: row.entityType,
      entityId: row.entityId,
      changes: row.changes as Record<string, unknown> | null,
      metadata: row.metadata as Record<string, unknown> | null,
      correlationId: row.correlationId,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      source: row.source,
      createdAt: row.createdAt,
      actorName: row.actorName ?? null,
      userName: row.userName ?? null,
      tenantName: row.tenantName ?? null,
    };
  }
}
