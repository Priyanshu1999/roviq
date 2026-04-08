import type { JetStreamContext } from '@roviq/nats-jetstream';
import type { AttendanceAbsentEvent } from '@roviq/notifications';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationTriggerService } from '../../services/notification-trigger.service';
import { PreferenceLoaderService } from '../../services/preference-loader.service';
import { AttendanceListener } from '../attendance.listener';

function makeEvent(overrides: Partial<AttendanceAbsentEvent> = {}): AttendanceAbsentEvent {
  return {
    tenantId: 'tenant-abc',
    studentId: 'student-123',
    studentName: 'Riya Sharma',
    sectionId: 'section-1',
    sectionName: '10-A',
    date: '2026-03-07',
    markedBy: 'teacher-99',
    ...overrides,
  };
}

function makeMockCtx(): JetStreamContext {
  return createMock<JetStreamContext>({
    getSubject: vi.fn().mockReturnValue('NOTIFICATION.attendance.absent'),
    getHeaders: vi.fn(),
    getStream: vi.fn().mockReturnValue('NOTIFICATION'),
    getDurableName: vi.fn().mockReturnValue('notification-attendance'),
    getDeliveryCount: vi.fn().mockReturnValue(1),
  });
}

describe('AttendanceListener', () => {
  let listener: AttendanceListener;
  let mockTriggerService: ReturnType<typeof createMock<NotificationTriggerService>>;
  let mockPreferenceLoader: ReturnType<typeof createMock<PreferenceLoaderService>>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTriggerService = createMock<NotificationTriggerService>({
      trigger: vi.fn().mockResolvedValue(undefined),
    });
    mockPreferenceLoader = createMock<PreferenceLoaderService>({
      loadConfig: vi.fn().mockResolvedValue({
        inApp: true,
        whatsapp: false,
        email: true,
        push: false,
        digest: false,
        digestCron: undefined,
      }),
    });

    listener = new AttendanceListener(mockTriggerService, mockPreferenceLoader);
  });

  describe('handleAbsent', () => {
    it('calls triggerService.trigger with workflowId "attendance-absent"', async () => {
      await listener.handleAbsent(makeEvent(), makeMockCtx());

      expect(mockTriggerService.trigger).toHaveBeenCalledOnce();
      expect(mockTriggerService.trigger).toHaveBeenCalledWith(
        expect.objectContaining({ workflowId: 'attendance-absent' }),
      );
    });

    it('passes channel config from preferenceLoader through to trigger payload', async () => {
      const channelConfig = {
        inApp: false,
        whatsapp: true,
        email: false,
        push: true,
        digest: true,
        digestCron: '0 9 * * *',
      };
      mockPreferenceLoader.loadConfig.mockResolvedValueOnce(channelConfig);

      await listener.handleAbsent(makeEvent(), makeMockCtx());

      expect(mockTriggerService.trigger).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            config: {
              inApp: false,
              whatsapp: true,
              email: false,
              push: true,
            },
            digestCron: '0 9 * * *',
          }),
        }),
      );
    });

    it('uses the plain studentId as subscriberId (no tenant prefix)', async () => {
      await listener.handleAbsent(makeEvent({ studentId: 'student-xyz' }), makeMockCtx());

      expect(mockTriggerService.trigger).toHaveBeenCalledWith(
        expect.objectContaining({
          to: { subscriberId: 'student-xyz' },
        }),
      );
    });

    it('calls preferenceLoader.loadConfig with tenantId and "ATTENDANCE" type', async () => {
      await listener.handleAbsent(makeEvent({ tenantId: 'tenant-42' }), makeMockCtx());

      expect(mockPreferenceLoader.loadConfig).toHaveBeenCalledWith('tenant-42', 'ATTENDANCE');
    });

    it('passes tenantId to triggerService.trigger', async () => {
      await listener.handleAbsent(makeEvent({ tenantId: 'tenant-99' }), makeMockCtx());

      expect(mockTriggerService.trigger).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-99' }),
      );
    });
  });
});
