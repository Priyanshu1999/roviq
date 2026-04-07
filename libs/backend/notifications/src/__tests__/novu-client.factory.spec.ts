import { createMock } from '@golevelup/ts-vitest';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { MockNovu } = vi.hoisted(() => ({
  MockNovu: vi.fn(),
}));

vi.mock('@novu/api', () => ({
  Novu: MockNovu,
}));

import { createNovuClient } from '../novu-client.factory';

function makeConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    NOVU_SECRET_KEY: 'test-secret',
    NOVU_MODE: 'cloud',
    NOVU_API_URL: 'http://localhost:3340',
    ...overrides,
  };

  return createMock<ConfigService>({
    get: vi.fn((key: string, fallback?: string) => values[key] ?? fallback),
    getOrThrow: vi.fn((key: string) => {
      if (!(key in values)) throw new Error(`Missing ${key}`);
      return values[key];
    }),
  });
}

describe('createNovuClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates Novu with only secretKey in cloud mode', () => {
    const config = makeConfig({ NOVU_MODE: 'cloud' });

    createNovuClient(config);

    expect(MockNovu).toHaveBeenCalledOnce();
    expect(MockNovu).toHaveBeenCalledWith({ secretKey: 'test-secret' });
  });

  it('defaults to cloud mode when NOVU_MODE is not set', () => {
    const config = createMock<ConfigService>({
      get: vi.fn((key: string, fallback?: string) => {
        // NOVU_MODE deliberately absent — should fall back to 'cloud'
        if (key === 'NOVU_MODE') return fallback;
        return undefined;
      }),
      getOrThrow: vi.fn().mockReturnValue('test-secret'),
    });

    createNovuClient(config);

    expect(MockNovu).toHaveBeenCalledWith({ secretKey: 'test-secret' });
  });

  it('passes serverURL when NOVU_MODE is local', () => {
    const config = makeConfig({
      NOVU_MODE: 'local',
      NOVU_API_URL: 'http://localhost:3340',
    });

    createNovuClient(config);

    expect(MockNovu).toHaveBeenCalledOnce();
    expect(MockNovu).toHaveBeenCalledWith({
      secretKey: 'test-secret',
      serverURL: 'http://localhost:3340',
    });
  });

  it('throws when NOVU_MODE=local but NOVU_API_URL is missing', () => {
    const config = makeConfig({ NOVU_MODE: 'local' });
    config.getOrThrow.mockImplementation((key: string) => {
      if (key === 'NOVU_API_URL') throw new Error('Missing NOVU_API_URL');
      return 'test-secret';
    });

    expect(() => createNovuClient(config)).toThrow('Missing NOVU_API_URL');
  });
});
