import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * AES-256-GCM encryption for payment gateway credentials.
 * Key from BILLING_ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 * Format: `{iv}:{authTag}:{ciphertext}` (all hex-encoded).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const hexKey = this.config.getOrThrow<string>('BILLING_ENCRYPTION_KEY');
    if (hexKey.length !== 64) {
      throw new Error('BILLING_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  /** Encrypt a JSON-serializable value. Returns `iv:tag:ciphertext` hex string. */
  encrypt(plaintext: unknown): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const json = JSON.stringify(plaintext);
    const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /** Decrypt an `iv:tag:ciphertext` hex string. Returns parsed JSON. */
  decrypt<T = unknown>(ciphertext: string): T {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format — expected iv:tag:ciphertext');
    }
    const [ivHex, tagHex, encHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');

    if (tag.length !== TAG_LENGTH) {
      throw new Error('Invalid auth tag length');
    }

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  }
}
