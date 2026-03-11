import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { AUDIT_DB_POOL } from './audit-db.provider';

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

import type { AuditLogFilterInput } from './dto/audit-log-filter.input';
import type { AuditLogConnection } from './models/audit-log-connection.model';

interface FindAuditLogsParams {
  tenantId: string;
  filter?: AuditLogFilterInput;
  first: number;
  after?: string;
}

@Injectable()
export class AuditService {
  constructor(@Inject(AUDIT_DB_POOL) private readonly pool: pg.Pool) {}

  async findAuditLogs(params: FindAuditLogsParams): Promise<AuditLogConnection> {
    const { tenantId, filter, first, after } = params;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // All conditions use "al." prefix for unambiguous JOINs
    // RLS handles tenant scoping, but we also filter explicitly
    // for defense-in-depth and to leverage the tenant_id index prefix
    conditions.push(`al.tenant_id = $${paramIndex++}`);
    values.push(tenantId);

    // Cursor: base64url("timestamp:uuid") → WHERE (created_at, id) < ($N, $N)
    if (after) {
      const { timestamp, id } = decodeCursor(after);
      conditions.push(`(al.created_at, al.id) < ($${paramIndex++}, $${paramIndex++})`);
      values.push(timestamp, id);
    }

    if (filter?.entityType) {
      conditions.push(`al.entity_type = $${paramIndex++}`);
      values.push(filter.entityType);
    }
    if (filter?.entityId) {
      conditions.push(`al.entity_id = $${paramIndex++}`);
      values.push(filter.entityId);
    }
    if (filter?.userId) {
      conditions.push(`al.user_id = $${paramIndex++}`);
      values.push(filter.userId);
    }
    if (filter?.actionTypes?.length) {
      conditions.push(`al.action_type = ANY($${paramIndex++})`);
      values.push(filter.actionTypes);
    }
    if (filter?.correlationId) {
      conditions.push(`al.correlation_id = $${paramIndex++}`);
      values.push(filter.correlationId);
    }
    if (filter?.dateRange) {
      conditions.push(`al.created_at >= $${paramIndex++}`);
      values.push(filter.dateRange.from);
      conditions.push(`al.created_at <= $${paramIndex++}`);
      values.push(filter.dateRange.to);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Fetch first+1 to determine hasNextPage, with user/org names via LEFT JOIN
    const dataQuery = `
      SELECT al.*,
        actor.username AS actor_name,
        u.username AS user_name,
        o.name AS tenant_name
      FROM audit_logs al
      LEFT JOIN users actor ON actor.id = al.actor_id
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN organizations o ON o.id = al.tenant_id
      ${whereClause}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT $${paramIndex++}
    `;
    values.push(first + 1);

    // Count query uses same filters without LIMIT (no JOINs needed for count)
    const countValues = values.slice(0, -1);
    const countQuery = `SELECT COUNT(*) FROM audit_logs al ${whereClause}`;

    // SET LOCAL requires a transaction to scope the RLS context variable
    const client = await this.pool.connect();
    let dataResult: pg.QueryResult;
    let countResult: pg.QueryResult;
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [tenantId]);
      [dataResult, countResult] = await Promise.all([
        client.query(dataQuery, values),
        client.query(countQuery, countValues),
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const hasNextPage = dataResult.rows.length > first;
    const rows = dataResult.rows.slice(0, first);
    const totalCount = Number.parseInt(countResult.rows[0].count, 10);

    const edges = rows.map((row: Record<string, unknown>) => ({
      cursor: Buffer.from(`${(row.created_at as Date).toISOString()}:${row.id}`).toString(
        'base64url',
      ),
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
  }

  private mapRow(row: Record<string, unknown>) {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      actorId: row.actor_id as string,
      impersonatorId: row.impersonator_id as string | null,
      action: row.action as string,
      actionType: row.action_type as string,
      entityType: row.entity_type as string,
      entityId: row.entity_id as string | null,
      changes: row.changes as Record<string, unknown> | null,
      metadata: row.metadata as Record<string, unknown> | null,
      correlationId: row.correlation_id as string,
      ipAddress: row.ip_address as string | null,
      userAgent: row.user_agent as string | null,
      source: row.source as string,
      createdAt: row.created_at as Date,
      actorName: (row.actor_name as string) ?? null,
      userName: (row.user_name as string) ?? null,
      tenantName: (row.tenant_name as string) ?? null,
    };
  }
}
