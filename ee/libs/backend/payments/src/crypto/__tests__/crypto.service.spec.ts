import { randomBytes } from 'node:crypto';
import { createMock } from '@golevelup/ts-vitest';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { CryptoService } from '../crypto.service';

const TEST_KEY = randomBytes(32).toString('hex');

function createService(): CryptoService {
  const config = createMock<ConfigService>({
    getOrThrow: vi.fn((key: string) => {
      if (key === 'BILLING_ENCRYPTION_KEY') return TEST_KEY;
      throw new Error(`Unexpected key: ${key}`);
    }),
  });
  return new CryptoService(config);
}

describe('CryptoService', () => {
  it('encrypts and decrypts a string roundtrip', () => {
    const service = createService();
    const plaintext = { apiKey: 'rzp_live_abc123', secret: 'sk_test_xyz' };
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt<typeof plaintext>(encrypted);
    expect(decrypted).toEqual(plaintext);
  });

  it('produces iv:tag:ciphertext format', () => {
    const service = createService();
    const encrypted = service.encrypt({ key: 'value' });
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // iv = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // ciphertext is non-empty
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const service = createService();
    const plaintext = { same: 'data' };
    const a = service.encrypt(plaintext);
    const b = service.encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it('throws on tampered ciphertext', () => {
    const service = createService();
    const encrypted = service.encrypt({ secret: 'data' });
    const parts = encrypted.split(':');
    // Flip a byte in ciphertext
    const tampered = `${parts[0]}:${parts[1]}:ff${parts[2].slice(2)}`;
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('throws on invalid format', () => {
    const service = createService();
    expect(() => service.decrypt('not-valid')).toThrow('Invalid ciphertext format');
  });

  it('throws on wrong key length', () => {
    const config = createMock<ConfigService>({ getOrThrow: vi.fn(() => 'tooshort') });
    expect(() => new CryptoService(config)).toThrow('64-character hex string');
  });
});
