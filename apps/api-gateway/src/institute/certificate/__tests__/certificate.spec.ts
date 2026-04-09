/**
 * ROV-170 — Unit tests for CertificateService "other certificates" methods.
 *
 * Pure unit: mocks `@roviq/database` (withTenant/withAdmin + tables) and the
 * request context so no DB is touched. Covers findCertificateById,
 * listCertificates type-filter branch, and requestCertificate insert shape.
 */
import type { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import type { DrizzleDB } from '@roviq/database';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Sequential result queue powering the mock Drizzle tx chain ──
const resultQueue: unknown[] = [];
let queueIndex = 0;

function queueResult(result: unknown) {
  resultQueue.push(result);
}

function resetQueue() {
  resultQueue.length = 0;
  queueIndex = 0;
}

function nextResult(): unknown {
  const result = resultQueue[queueIndex] ?? [];
  queueIndex++;
  return result;
}

interface CapturedInsert {
  table: string;
  values: Record<string, unknown> | null;
}
const capturedInserts: CapturedInsert[] = [];
let currentTable: string | null = null;

function createMockTx() {
  const terminal = vi.fn(() => Promise.resolve(nextResult()));
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'insert') {
          return (table: { __tableName?: string }) => {
            currentTable = table.__tableName ?? 'unknown';
            return createMockTx();
          };
        }
        if (prop === 'values') {
          return (vals: Record<string, unknown>) => {
            capturedInserts.push({ table: currentTable ?? 'unknown', values: vals });
            return createMockTx();
          };
        }
        if (prop === 'onConflictDoNothing') return () => Promise.resolve();
        if (prop === 'limit' || prop === 'returning') return terminal;
        if (prop === 'then') {
          return (resolve: (v: unknown) => void) => resolve(nextResult());
        }
        if (prop === 'execute') {
          return vi.fn(() =>
            Promise.resolve({ rows: [{ next_val: '1', formatted: 'CERT/TRA/0001' }] }),
          );
        }
        return vi.fn(() => createMockTx());
      },
    },
  );
}

async function mockWithContext(_db: unknown, ...args: unknown[]) {
  const fn = args[args.length - 1] as (tx: unknown) => Promise<unknown>;
  return fn(createMockTx());
}

vi.mock('@roviq/database', () => ({
  DRIZZLE_DB: Symbol('DRIZZLE_DB'),
  withAdmin: vi.fn(mockWithContext),
  withTenant: vi.fn(mockWithContext),
  issuedCertificates: { __tableName: 'issuedCertificates', id: 'id', status: 'status' },
  certificateTemplates: { __tableName: 'certificateTemplates', id: 'id', type: 'type' },
  studentProfiles: {
    __tableName: 'studentProfiles',
    id: 'id',
    userId: 'user_id',
    admissionNumber: 'admission_number',
    admissionClass: 'admission_class',
  },
  userProfiles: { __tableName: 'userProfiles', userId: 'user_id' },
  tcRegister: { __tableName: 'tcRegister', id: 'id', status: 'status' },
  tenantSequences: { __tableName: 'tenantSequences' },
}));

vi.mock('@roviq/common-types', () => ({
  getRequestContext: () => ({ tenantId: 'tenant-1', userId: 'user-1' }),
}));

vi.mock('@temporalio/client', () => {
  class FakeTemporalClient {
    workflow = { start: vi.fn(() => Promise.resolve()) };
  }
  return {
    Client: FakeTemporalClient,
    Connection: { connect: vi.fn(() => Promise.resolve({ close: vi.fn() })) },
  };
});

// Import AFTER mocks.
import { CertificateService } from '../certificate.service';

describe('CertificateService (unit)', () => {
  let service: CertificateService;

  beforeEach(() => {
    resetQueue();
    capturedInserts.length = 0;
    currentTable = null;
    const db = createMock<DrizzleDB>();
    const natsClient = createMock<ClientProxy>({
      emit: vi.fn(() => ({ subscribe: vi.fn() })),
    });
    const config = createMock<ConfigService>({
      get: vi.fn(() => 'localhost:7233'),
    });
    service = new CertificateService(db, natsClient, config);
  });

  describe('findCertificateById', () => {
    it('returns the row produced by the mocked select chain', async () => {
      const certRow = { id: 'cert-1', status: 'issued', serialNumber: 'CERT/TRA/0001' };
      queueResult([certRow]);
      const result = await service.findCertificateById('cert-1');
      expect(result).toEqual(certRow);
    });

    it('throws NotFoundException when no row is returned', async () => {
      queueResult([]);
      await expect(service.findCertificateById('missing')).rejects.toThrow(/not found/i);
    });
  });

  describe('listCertificates', () => {
    it('returns rows for a type filter via the template join branch', async () => {
      const joinRow = { cert: { id: 'cert-1', status: 'issued' } };
      queueResult([joinRow]);
      const result = await service.listCertificates({ type: 'transfer' });
      expect(result).toEqual([joinRow.cert]);
    });
  });

  describe('requestCertificate', () => {
    it('inserts an issued_certificate row with template data and actor tenant', async () => {
      // 1. Template lookup.
      queueResult([
        {
          id: 'tpl-1',
          type: 'character',
          approvalChain: [],
        },
      ]);
      // 2. Insert .returning() for the issued certificate.
      queueResult([
        {
          id: 'cert-new',
          tenantId: 'tenant-1',
          templateId: 'tpl-1',
          serialNumber: 'CERT/CHA/0001',
          status: 'draft',
        },
      ]);

      const result = await service.requestCertificate({
        templateId: 'tpl-1',
        purpose: 'Bonafide for passport',
      });

      expect(result.id).toBe('cert-new');
      const certInsert = capturedInserts.find((c) => c.table === 'issuedCertificates');
      expect(certInsert).toBeDefined();
      expect(certInsert?.values?.tenantId).toBe('tenant-1');
      expect(certInsert?.values?.templateId).toBe('tpl-1');
      expect(certInsert?.values?.purpose).toBe('Bonafide for passport');
      expect(certInsert?.values?.createdBy).toBe('user-1');
      // No approval chain → status starts as draft.
      expect(certInsert?.values?.status).toBe('draft');
    });
  });
});
