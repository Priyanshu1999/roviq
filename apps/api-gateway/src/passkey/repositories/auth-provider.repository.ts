import type { AuthProviderRecord, CreatePasskeyData } from './types';

export abstract class AuthProviderRepository {
  /**
   * Returns passkeys for a user, ordered by createdAt DESC (newest first).
   */
  abstract findPasskeysByUserId(userId: string): Promise<AuthProviderRecord[]>;
  abstract findByActiveUsername(username: string): Promise<AuthProviderRecord[]>;
  abstract findByCredentialId(credentialId: string): Promise<AuthProviderRecord | null>;
  abstract create(data: CreatePasskeyData): Promise<AuthProviderRecord>;
  abstract updateProviderData(id: string, data: unknown): Promise<void>;
  abstract countOtherPasskeys(userId: string, excludeId: string): Promise<number>;
  abstract deletePasskey(id: string, userId: string): Promise<number>;
}
