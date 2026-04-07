import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferenceLoaderService } from '../preference-loader.service';

function createMockConfigRepo() {
  return {
    findByTenantAndType: vi.fn().mockResolvedValue(null),
  };
}

function makeConfigRow(overrides: Record<string, unknown> = {}) {
  return {
    inAppEnabled: true,
    whatsappEnabled: true,
    emailEnabled: true,
    pushEnabled: false,
    digestEnabled: false,
    digestCron: null,
    ...overrides,
  };
}

describe('PreferenceLoaderService', () => {
  let service: PreferenceLoaderService;
  let mockRepo: ReturnType<typeof createMockConfigRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = createMockConfigRepo();
    service = new PreferenceLoaderService(mockRepo as never);
  });

  describe('loadConfig', () => {
    it('returns correct values when config exists in DB', async () => {
      const row = makeConfigRow({
        inAppEnabled: true,
        whatsappEnabled: false,
        emailEnabled: true,
        pushEnabled: true,
        digestEnabled: true,
        digestCron: '0 8 * * *',
      });
      mockRepo.findByTenantAndType.mockResolvedValueOnce(row);

      const result = await service.loadConfig('tenant-abc', 'ATTENDANCE');

      expect(result).toEqual({
        inApp: true,
        whatsapp: false,
        email: true,
        push: true,
        digest: true,
        digestCron: '0 8 * * *',
      });
    });

    it('delegates to repository with correct arguments', async () => {
      const row = makeConfigRow();
      mockRepo.findByTenantAndType.mockResolvedValueOnce(row);

      await service.loadConfig('tenant-xyz', 'FEE');

      expect(mockRepo.findByTenantAndType).toHaveBeenCalledWith('tenant-xyz', 'FEE');
    });

    it('returns defaults when no config row is found', async () => {
      mockRepo.findByTenantAndType.mockResolvedValueOnce(null);

      const result = await service.loadConfig('tenant-abc', 'ATTENDANCE');

      expect(result).toEqual({
        inApp: true,
        whatsapp: true,
        email: true,
        push: false,
        digest: false,
      });
    });

    it('default config has no digestCron', async () => {
      mockRepo.findByTenantAndType.mockResolvedValueOnce(null);

      const result = await service.loadConfig('tenant-abc', 'ATTENDANCE');

      expect(result.digestCron).toBeUndefined();
    });

    it('returns undefined digestCron when DB digestCron is null', async () => {
      const row = makeConfigRow({ digestCron: null });
      mockRepo.findByTenantAndType.mockResolvedValueOnce(row);

      const result = await service.loadConfig('tenant-abc', 'ATTENDANCE');

      expect(result.digestCron).toBeUndefined();
    });

    it('returns digestCron string when set in DB', async () => {
      const row = makeConfigRow({ digestEnabled: true, digestCron: '0 9 * * 1-5' });
      mockRepo.findByTenantAndType.mockResolvedValueOnce(row);

      const result = await service.loadConfig('tenant-abc', 'ATTENDANCE');

      expect(result.digestCron).toBe('0 9 * * 1-5');
    });

    it('returns fresh default object each call (no shared reference)', async () => {
      mockRepo.findByTenantAndType.mockResolvedValue(null);

      const result1 = await service.loadConfig('tenant-1', 'ATTENDANCE');
      const result2 = await service.loadConfig('tenant-2', 'ATTENDANCE');

      result1.inApp = false;
      expect(result2.inApp).toBe(true);
    });
  });
});
