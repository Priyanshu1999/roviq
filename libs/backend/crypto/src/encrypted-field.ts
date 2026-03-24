import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * AES-256-GCM encryption for identity fields (Aadhaar, PAN).
 * Key from `IDENTITY_ENCRYPTION_KEY` env var (64-char hex = 32 bytes).
 * Format: packed Buffer of `IV (12B) + authTag (16B) + ciphertext`.
 */
@Injectable()
export class IdentityCryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const hexKey = this.config.getOrThrow<string>('IDENTITY_ENCRYPTION_KEY');
    if (hexKey.length !== 64) {
      throw new Error(
        'IDENTITY_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
          "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
      );
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM.
   * Returns a Buffer containing: IV (12 bytes) + authTag (16 bytes) + ciphertext.
   */
  encrypt(plaintext: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt a Buffer produced by `encrypt`.
   * Expects: IV (12 bytes) + authTag (16 bytes) + ciphertext.
   */
  decrypt(packed: Buffer): string {
    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }
}
