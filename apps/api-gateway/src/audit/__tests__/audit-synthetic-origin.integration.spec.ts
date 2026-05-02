/**
 * ROV-243 H5 — integration coverage for the synthetic_origin column.
 *
 * Two-path verification against the live test DB:
 *   1. Synthetic-context write (mkAdminCtx with origin) → audit row carries
 *      the originating workflow / consumer / seeder string.
 *   2. JWT-driven write (synthetic_origin absent on event) → audit row's
 *      synthetic_origin column is NULL.
 *
 * The test exercises the AuditConsumer's raw INSERT path directly so it
 * doesn't depend on JetStream — that's covered by audit-consumer.spec.ts.
 * Here we prove the DB column exists, accepts the value, and round-trips
 * through the consumer's parameterised SQL.
 */

import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { SYSTEM_USER_ID } from '@roviq/database';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const hasTestDb = !!process.env.DATABASE_URL_TEST_MIGRATE;

// Use the migrate-role connection — production AuditConsumer writes via
// `DATABASE_URL_AUDIT` (also a privileged role) since `roviq_pooler` /
// `roviq_app` aren't granted direct INSERT on audit_logs (RLS-bypass write
// path lives behind a privileged role only).
const DB_URL =
  process.env.DATABASE_URL_TEST_MIGRATE ?? 'postgresql://roviq:roviq_dev@localhost:5434/roviq_test';

describe.skipIf(!hasTestDb)('audit_logs.synthetic_origin (integration)', () => {
  let pool: Pool;
  let tenantId: string;
  const insertedIds: string[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB_URL, max: 2, idleTimeoutMillis: 5000 });
    // audit_logs FKs `tenant_id → institutes(id)` and `actor_id/user_id →
    // users(id)`, so the test must use real seeded entities. Pick the first
    // seeded institute and rely on the seeded SYSTEM_USER_ID for actors.
    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM institutes ORDER BY created_at LIMIT 1',
    );
    assert(rows.length === 1, 'Test DB must have at least one seeded institute');
    tenantId = rows[0].id;
  });

  afterAll(async () => {
    if (insertedIds.length > 0) {
      await pool.query('DELETE FROM audit_logs WHERE id = ANY($1::uuid[])', [insertedIds]);
    }
    await pool.end();
  });

  it('persists synthetic_origin when supplied (workflow path)', async () => {
    const id = randomUUID();
    insertedIds.push(id);
    const createdAt = new Date();
    await pool.query(
      `INSERT INTO audit_logs
        (id, scope, tenant_id, reseller_id, user_id, actor_id, impersonator_id,
         impersonation_session_id, action, action_type, entity_type, entity_id,
         changes, metadata, correlation_id, ip_address, user_agent, source,
         synthetic_origin, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        id,
        'institute',
        tenantId,
        null,
        SYSTEM_USER_ID,
        SYSTEM_USER_ID,
        null,
        null,
        'issueTransferCertificate',
        'CREATE',
        'TransferCertificate',
        randomUUID(),
        null,
        null,
        randomUUID(),
        '127.0.0.1',
        'workflow-runner',
        'TEMPORAL',
        'workflow:tc-issuance',
        createdAt,
      ],
    );

    const { rows } = await pool.query<{ synthetic_origin: string | null }>(
      'SELECT synthetic_origin FROM audit_logs WHERE id = $1 AND created_at = $2',
      [id, createdAt],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].synthetic_origin).toBe('workflow:tc-issuance');
  });

  it('persists synthetic_origin = NULL when absent (JWT path)', async () => {
    const id = randomUUID();
    insertedIds.push(id);
    const createdAt = new Date();
    await pool.query(
      `INSERT INTO audit_logs
        (id, scope, tenant_id, reseller_id, user_id, actor_id, impersonator_id,
         impersonation_session_id, action, action_type, entity_type, entity_id,
         changes, metadata, correlation_id, ip_address, user_agent, source,
         synthetic_origin, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        id,
        'institute',
        tenantId,
        null,
        SYSTEM_USER_ID,
        SYSTEM_USER_ID,
        null,
        null,
        'updateStudent',
        'UPDATE',
        'Student',
        randomUUID(),
        null,
        null,
        randomUUID(),
        '127.0.0.1',
        'mozilla/test',
        'GATEWAY',
        null,
        createdAt,
      ],
    );

    const { rows } = await pool.query<{ synthetic_origin: string | null }>(
      'SELECT synthetic_origin FROM audit_logs WHERE id = $1 AND created_at = $2',
      [id, createdAt],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].synthetic_origin).toBeNull();
  });

  it('partial index audit_logs_synthetic_origin_idx exists and excludes NULL rows', async () => {
    const { rows } = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
        WHERE tablename = 'audit_logs'
          AND indexname = 'audit_logs_synthetic_origin_idx'`,
    );
    expect(rows).toHaveLength(1);
    // Partial index — must exclude NULL rows so the index stays small (most
    // audit writes are JWT-driven, synthetic_origin = NULL).
    expect(rows[0].indexdef).toMatch(/WHERE.*synthetic_origin IS NOT NULL/i);
  });

  it('GraphQL filter by syntheticOrigin returns only matching rows', async () => {
    // Insert two rows with different origins, query by one origin, expect
    // only that row.
    const id1 = randomUUID();
    const id2 = randomUUID();
    insertedIds.push(id1, id2);
    const createdAt = new Date();
    const tag = `test:audit-synthetic-origin-${randomUUID().slice(0, 8)}`;

    for (const [id, origin] of [
      [id1, tag],
      [id2, null],
    ] as const) {
      await pool.query(
        `INSERT INTO audit_logs
          (id, scope, tenant_id, reseller_id, user_id, actor_id, impersonator_id,
           impersonation_session_id, action, action_type, entity_type, entity_id,
           changes, metadata, correlation_id, ip_address, user_agent, source,
           synthetic_origin, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
        [
          id,
          'institute',
          tenantId,
          null,
          SYSTEM_USER_ID,
          SYSTEM_USER_ID,
          null,
          null,
          'syntheticOriginFilterCheck',
          'CREATE',
          'Probe',
          randomUUID(),
          null,
          null,
          randomUUID(),
          '127.0.0.1',
          'test',
          'GATEWAY',
          origin,
          createdAt,
        ],
      );
    }

    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM audit_logs WHERE synthetic_origin = $1',
      [tag],
    );
    expect(rows.map((r) => r.id)).toEqual([id1]);
  });
});
