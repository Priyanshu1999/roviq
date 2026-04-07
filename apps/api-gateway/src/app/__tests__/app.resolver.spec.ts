import { createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppResolver } from '../app.resolver';

describe('AppResolver', () => {
  let resolver: AppResolver;
  let config: ConfigService;

  beforeEach(() => {
    config = createMock<ConfigService>({ get: vi.fn() });
    resolver = new AppResolver(config);
  });

  describe('edition', () => {
    it('should return "ee" when ROVIQ_EE is true', () => {
      vi.mocked(config.get).mockReturnValue('true');

      expect(resolver.edition()).toBe('ee');
      expect(config.get).toHaveBeenCalledWith('ROVIQ_EE');
    });

    it('should return "ce" when ROVIQ_EE is not set', () => {
      vi.mocked(config.get).mockReturnValue(undefined);

      expect(resolver.edition()).toBe('ce');
    });

    it('should return "ce" when ROVIQ_EE is false', () => {
      vi.mocked(config.get).mockReturnValue('false');

      expect(resolver.edition()).toBe('ce');
    });
  });
});
