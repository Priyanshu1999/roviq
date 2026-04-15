/**
 * M1 User Profile Schema Integration Tests (ROV-151).
 *
 * Verifies platform-level tables: user_profiles, user_identifiers,
 * user_documents, user_addresses — NO RLS, GRANT-based access.
 *
 * Run: pnpm nx test database --testPathPattern=user-profiles-schema
 */
import { createHash } from 'node:crypto';
import { AddressType, UserIdentifierType } from '@roviq/common-types';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TEST_SUPERUSER_URL } from './test-helpers';

const SUPERUSER_URL = TEST_SUPERUSER_URL;

/** Use the same admin user from the seed for FK references */
const SEED = {
  USER_ADMIN: '00000000-0000-4000-a000-000000000201',
  USER_TEACHER: '00000000-0000-4000-a000-000000000202',
};

let superPool: pg.Pool;

beforeAll(async () => {
  superPool = new pg.Pool({ connectionString: SUPERUSER_URL, max: 2 });
  const res = await superPool.query('SELECT 1 as ok');
  expect(res.rows[0].ok).toBe(1);
});

afterAll(async () => {
  await superPool.end();
});

/** Execute a callback inside a transaction that is always rolled back. */
async function inTransaction(fn: (client: pg.PoolClient) => Promise<void>): Promise<void> {
  const client = await superPool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

// ── user_profiles ──────────────────────────────────────────────

describe('ROV-151: user_profiles', () => {
  // first_name / last_name are i18nText jsonb columns — `{"en":"...","hi":"..."}`
  const enName = (s: string) => JSON.stringify({ en: s });

  // The seeded admin user already has a user_profiles row (unique on user_id),
  // so inserts keyed to SEED.USER_ADMIN collide. Delete the row within the
  // rolled-back transaction so the test's INSERT exercises the real insert
  // path. `ROLLBACK` unwinds both the DELETE and INSERT.
  const clearExistingProfile = (client: pg.PoolClient, userId: string) =>
    client.query(`DELETE FROM user_profiles WHERE user_id = $1`, [userId]);

  it('INSERT as roviq_app succeeds (no RLS blocking)', async () => {
    await inTransaction(async (client) => {
      await clearExistingProfile(client, SEED.USER_ADMIN);
      // Switch to roviq_app role to verify GRANTs work
      await client.query(`SET LOCAL ROLE roviq_app`);

      const profileId = 'eeeeeeee-1001-0001-0001-000000000001';
      await client.query(
        `INSERT INTO user_profiles (id, user_id, first_name, last_name, created_by, updated_by)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $5)`,
        [profileId, SEED.USER_ADMIN, enName('Test'), enName('User'), SEED.USER_ADMIN],
      );

      const res = await client.query(`SELECT first_name FROM user_profiles WHERE id = $1`, [
        profileId,
      ]);
      expect(res.rows[0].first_name).toEqual({ en: 'Test' });
    });
  });

  it('search_vector is populated and GIN index returns results', async () => {
    await inTransaction(async (client) => {
      await clearExistingProfile(client, SEED.USER_ADMIN);
      const profileId = 'eeeeeeee-1002-0001-0001-000000000001';
      await client.query(
        `INSERT INTO user_profiles (id, user_id, first_name, last_name, created_by, updated_by)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $5)`,
        [profileId, SEED.USER_ADMIN, enName('Anil'), enName('Sharma'), SEED.USER_ADMIN],
      );

      // Verify search_vector is auto-populated by the GENERATED ALWAYS AS column
      const res = await client.query(
        `SELECT id FROM user_profiles
         WHERE search_vector @@ to_tsquery('simple', 'Anil')`,
      );
      expect(res.rows.length).toBeGreaterThanOrEqual(1);
      expect(res.rows.some((r: { id: string }) => r.id === profileId)).toBe(true);
    });
  });

  it('first_name jsonb stores Hindi characters correctly (UTF-8)', async () => {
    await inTransaction(async (client) => {
      await clearExistingProfile(client, SEED.USER_ADMIN);
      const profileId = 'eeeeeeee-1003-0001-0001-000000000001';
      const firstNameI18n = JSON.stringify({ en: 'Raj', hi: 'राज कुमार' });

      await client.query(
        `INSERT INTO user_profiles (id, user_id, first_name, created_by, updated_by)
         VALUES ($1, $2, $3::jsonb, $4, $4)`,
        [profileId, SEED.USER_ADMIN, firstNameI18n, SEED.USER_ADMIN],
      );

      const res = await client.query(`SELECT first_name FROM user_profiles WHERE id = $1`, [
        profileId,
      ]);
      expect(res.rows[0].first_name).toEqual({ en: 'Raj', hi: 'राज कुमार' });
    });
  });

  it('blood_group CHECK rejects invalid value', async () => {
    await inTransaction(async (client) => {
      const err = await client
        .query(
          `INSERT INTO user_profiles (id, user_id, first_name, blood_group, created_by, updated_by)
           VALUES ($1, $2, $3::jsonb, 'X+', $4, $4)`,
          [
            'eeeeeeee-1004-0001-0001-000000000001',
            SEED.USER_ADMIN,
            enName('Test'),
            SEED.USER_ADMIN,
          ],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/chk_blood_group|violates check constraint/i);
    });
  });

  it('gender CHECK rejects invalid value', async () => {
    await inTransaction(async (client) => {
      const err = await client
        .query(
          `INSERT INTO user_profiles (id, user_id, first_name, gender, created_by, updated_by)
           VALUES ($1, $2, $3::jsonb, 'unknown', $4, $4)`,
          [
            'eeeeeeee-1005-0001-0001-000000000001',
            SEED.USER_ADMIN,
            enName('Test'),
            SEED.USER_ADMIN,
          ],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/invalid input value for enum/i);
    });
  });
});

// ── user_identifiers ───────────────────────────────────────────

describe('ROV-151: user_identifiers', () => {
  it('encryption roundtrip: encrypt → store → read → decrypt matches original', async () => {
    await inTransaction(async (client) => {
      // Inline AES-256-GCM encrypt/decrypt matching IdentityCryptoService format.
      // Integration tests don't use NestJS DI — raw crypto replicates the same wire format.
      const { createCipheriv, createDecipheriv, randomBytes } = await import('node:crypto');
      const key = randomBytes(32);
      const plaintext = '123456789012';

      // Encrypt: IV (12B) + authTag (16B) + ciphertext
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      const packed = Buffer.concat([iv, tag, enc]);

      const hash = createHash('sha256').update(plaintext).digest('hex');
      const masked = 'XXXX-XXXX-9012';

      const identId = 'eeeeeeee-2001-0001-0001-000000000001';
      await client.query(
        `INSERT INTO user_identifiers (id, user_id, type, value_encrypted, value_hash, value_masked)
         VALUES ($1, $2, '${UserIdentifierType.AADHAAR}', $3, $4, $5)`,
        [identId, SEED.USER_ADMIN, packed, hash, masked],
      );

      const res = await client.query(
        `SELECT value_encrypted, value_hash, value_masked FROM user_identifiers WHERE id = $1`,
        [identId],
      );

      // Decrypt: unpack IV + authTag + ciphertext
      const stored = Buffer.from(res.rows[0].value_encrypted);
      const storedIv = stored.subarray(0, 12);
      const storedTag = stored.subarray(12, 28);
      const storedEnc = stored.subarray(28);
      const decipher = createDecipheriv('aes-256-gcm', key, storedIv);
      decipher.setAuthTag(storedTag);
      const decrypted = decipher.update(storedEnc) + decipher.final('utf8');

      expect(decrypted).toBe(plaintext);
      expect(res.rows[0].value_hash).toBe(hash);
      expect(res.rows[0].value_masked).toBe(masked);
    });
  });

  it('type CHECK rejects invalid identifier type', async () => {
    await inTransaction(async (client) => {
      const err = await client
        .query(
          `INSERT INTO user_identifiers (id, user_id, type, value_plain)
           VALUES ($1, $2, 'invalid_type', 'SOME123')`,
          ['eeeeeeee-2002-0001-0001-000000000001', SEED.USER_ADMIN],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/invalid input value for enum/i);
    });
  });

  it('UNIQUE(user_id, type) rejects duplicate identifier type per user', async () => {
    await inTransaction(async (client) => {
      const id1 = 'eeeeeeee-2003-0001-0001-000000000001';
      const id2 = 'eeeeeeee-2003-0001-0001-000000000002';

      await client.query(
        `INSERT INTO user_identifiers (id, user_id, type, value_plain) VALUES ($1, $2, '${UserIdentifierType.APAAR}', 'APAAR001')`,
        [id1, SEED.USER_ADMIN],
      );

      const err = await client
        .query(
          `INSERT INTO user_identifiers (id, user_id, type, value_plain) VALUES ($1, $2, '${UserIdentifierType.APAAR}', 'APAAR002')`,
          [id2, SEED.USER_ADMIN],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });

  it('value CHECK rejects row with neither encrypted nor plain value', async () => {
    await inTransaction(async (client) => {
      const err = await client
        .query(
          `INSERT INTO user_identifiers (id, user_id, type)
           VALUES ($1, $2, '${UserIdentifierType.PAN}')`,
          ['eeeeeeee-2004-0001-0001-000000000001', SEED.USER_ADMIN],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/chk_identifier_value|violates check constraint/i);
    });
  });
});

// ── user_addresses ─────────────────────────────────────────────

describe('ROV-151: user_addresses', () => {
  it('UNIQUE(user_id, type) rejects second permanent address for same user', async () => {
    await inTransaction(async (client) => {
      const addr1 = 'eeeeeeee-3001-0001-0001-000000000001';
      const addr2 = 'eeeeeeee-3001-0001-0001-000000000002';

      await client.query(
        `INSERT INTO user_addresses (id, user_id, type, line1, city, state, postal_code)
         VALUES ($1, $2, '${AddressType.PERMANENT}', '123 Main St', 'Jaipur', 'Rajasthan', '302001')`,
        [addr1, SEED.USER_ADMIN],
      );

      const err = await client
        .query(
          `INSERT INTO user_addresses (id, user_id, type, line1, city, state, postal_code)
           VALUES ($1, $2, 'PERMANENT', '456 Other St', 'Jodhpur', 'Rajasthan', '342001')`,
          [addr2, SEED.USER_ADMIN],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    });
  });

  it('allows different address types for same user', async () => {
    await inTransaction(async (client) => {
      const addr1 = 'eeeeeeee-3002-0001-0001-000000000001';
      const addr2 = 'eeeeeeee-3002-0001-0001-000000000002';

      await client.query(
        `INSERT INTO user_addresses (id, user_id, type, line1, city, state, postal_code)
         VALUES ($1, $2, '${AddressType.PERMANENT}', '123 Main St', 'Jaipur', 'Rajasthan', '302001')`,
        [addr1, SEED.USER_ADMIN],
      );

      await client.query(
        `INSERT INTO user_addresses (id, user_id, type, line1, city, state, postal_code)
         VALUES ($1, $2, '${AddressType.CURRENT}', '456 Other St', 'Jodhpur', 'Rajasthan', '342001')`,
        [addr2, SEED.USER_ADMIN],
      );

      const res = await client.query(
        `SELECT id FROM user_addresses WHERE user_id = $1 AND id IN ($2, $3)`,
        [SEED.USER_ADMIN, addr1, addr2],
      );
      expect(res.rows).toHaveLength(2);
    });
  });

  it('address type CHECK rejects invalid type', async () => {
    await inTransaction(async (client) => {
      const err = await client
        .query(
          `INSERT INTO user_addresses (id, user_id, type, line1, city, state, postal_code)
           VALUES ($1, $2, 'billing', '123 Main', 'Jaipur', 'Rajasthan', '302001')`,
          ['eeeeeeee-3003-0001-0001-000000000001', SEED.USER_ADMIN],
        )
        .catch((e: Error) => e);

      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch(/invalid input value for enum/i);
    });
  });
});
