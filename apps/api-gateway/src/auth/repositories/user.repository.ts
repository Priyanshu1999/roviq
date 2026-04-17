import type { CreateUserData, UserRecord } from './types';

export abstract class UserRepository {
  abstract create(data: CreateUserData): Promise<UserRecord>;
  abstract findById(id: string): Promise<UserRecord | null>;
  abstract findByUsername(username: string): Promise<UserRecord | null>;
  abstract updatePasswordHash(id: string, passwordHash: string, changedAt: Date): Promise<void>;
  /**
   * ROV-96 — Set a brand-new password and clear the first-login flag in one statement.
   * Updates `password_hash`, sets `password_changed_at = now()`, and resets
   * `must_change_password = false`. Used by the changePassword mutation.
   */
  abstract updatePassword(userId: string, passwordHash: string): Promise<void>;
}
