import type { ClientProxy } from '@nestjs/microservices';
import { createMock } from '@roviq/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditEmitter, type AuditEventPayload } from '../audit-emitter';

// Mock ClientProxy
function createMockClient() {
  return createMock<ClientProxy>({
    emit: vi.fn().mockReturnValue(of(undefined)),
  });
}

function makePayload(overrides: Partial<AuditEventPayload> = {}): AuditEventPayload {
  return {
    scope: 'institute',
    tenantId: '00000000-0000-4000-a000-000000000101',
    resellerId: null,
    userId: 'user-1',
    actorId: 'actor-1',
    impersonatorId: null,
    impersonationSessionId: null,
    action: 'createStudent',
    actionType: 'CREATE',
    entityType: 'Student',
    entityId: 'entity-1',
    changes: null,
    metadata: null,
    correlationId: 'corr-1',
    source: 'CORE_SERVICE',
    ...overrides,
  };
}

describe('AuditEmitter', () => {
  let emitter: AuditEmitter;
  let mockClient: ReturnType<typeof createMockClient>;

  beforeEach(() => {
    mockClient = createMockClient();
    // Construct AuditEmitter manually, bypassing DI
    emitter = new AuditEmitter(mockClient);
  });

  describe('emit()', () => {
    it('publishes to AUDIT.log subject with correct payload', async () => {
      const payload = makePayload();

      await emitter.emit(payload);

      expect(mockClient.emit).toHaveBeenCalledOnce();
      expect(mockClient.emit).toHaveBeenCalledWith(
        'AUDIT.log',
        expect.objectContaining({
          scope: 'institute',
          tenantId: '00000000-0000-4000-a000-000000000101',
          resellerId: null,
          userId: 'user-1',
          actorId: 'actor-1',
          impersonatorId: null,
          impersonationSessionId: null,
          action: 'createStudent',
          actionType: 'CREATE',
          entityType: 'Student',
          entityId: 'entity-1',
          correlationId: 'corr-1',
          source: 'CORE_SERVICE',
        }),
      );
    });

    it('auto-generates id (UUID) and createdAt (ISO timestamp)', async () => {
      await emitter.emit(makePayload());

      const published = mockClient.emit.mock.calls[0][1] as AuditEventPayload & {
        id: string;
        createdAt: string;
      };
      expect(published.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(() => new Date(published.createdAt).toISOString()).not.toThrow();
    });

    it('works with platform scope (tenantId=null, resellerId=null)', async () => {
      const payload = makePayload({
        scope: 'platform',
        tenantId: null,
        resellerId: null,
        action: 'archivePlan',
        actionType: 'DELETE',
        entityType: 'SubscriptionPlan',
      });

      await emitter.emit(payload);

      const published = mockClient.emit.mock.calls[0][1] as AuditEventPayload;
      expect(published.scope).toBe('platform');
      expect(published.tenantId).toBeNull();
      expect(published.resellerId).toBeNull();
    });

    it('works with reseller scope (resellerId set, tenantId=null)', async () => {
      const payload = makePayload({
        scope: 'reseller',
        tenantId: null,
        resellerId: 'reseller-1',
        action: 'suspendInstitute',
        actionType: 'SUSPEND',
        entityType: 'Institute',
      });

      await emitter.emit(payload);

      const published = mockClient.emit.mock.calls[0][1] as AuditEventPayload;
      expect(published.scope).toBe('reseller');
      expect(published.resellerId).toBe('reseller-1');
      expect(published.tenantId).toBeNull();
    });

    it('includes impersonation fields when set', async () => {
      const payload = makePayload({
        impersonatorId: 'admin-1',
        impersonationSessionId: 'session-1',
      });

      await emitter.emit(payload);

      const published = mockClient.emit.mock.calls[0][1] as AuditEventPayload;
      expect(published.impersonatorId).toBe('admin-1');
      expect(published.impersonationSessionId).toBe('session-1');
    });

    it('does not validate scope vs tenantId (DB CHECK handles that)', async () => {
      // scope='institute' with tenantId=null is invalid, but emitter should NOT reject it.
      // The CHECK constraint in PostgreSQL enforces this, not the emitter.
      const payload = makePayload({ scope: 'institute', tenantId: null });

      await expect(emitter.emit(payload)).resolves.toBeUndefined();
      expect(mockClient.emit).toHaveBeenCalledOnce();
    });

    it('propagates JetStream publish errors', async () => {
      mockClient.emit.mockReturnValue(throwError(() => new Error('JetStream unavailable')));

      await expect(emitter.emit(makePayload())).rejects.toThrow('JetStream unavailable');
    });
  });

  describe('emitBulk()', () => {
    it('sets entityId to null and puts entity_ids + affected_count in metadata', async () => {
      await emitter.emitBulk({
        ...makePayload({ entityId: null }),
        entityIds: ['e1', 'e2', 'e3'],
        affectedCount: 3,
      });

      const published = mockClient.emit.mock.calls[0][1] as AuditEventPayload;
      expect(published.entityId).toBeNull();
      expect(published.metadata).toEqual({
        entity_ids: ['e1', 'e2', 'e3'],
        affected_count: 3,
      });
    });

    it('merges existing metadata with bulk fields', async () => {
      await emitter.emitBulk({
        ...makePayload({
          entityId: null,
          metadata: { trigger: 'reseller_suspension' },
        }),
        entityIds: ['s1', 's2'],
        affectedCount: 2,
      });

      const published = mockClient.emit.mock.calls[0][1] as AuditEventPayload;
      expect(published.metadata).toEqual({
        trigger: 'reseller_suspension',
        entity_ids: ['s1', 's2'],
        affected_count: 2,
      });
    });
  });
});
