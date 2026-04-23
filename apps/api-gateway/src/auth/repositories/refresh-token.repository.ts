import type { CreateRefreshTokenData, RefreshTokenWithRelations } from './types';

/**
 * Audit tag on every revocation path. Read by the reuse-detection cascade
 * in `AuthService.refresh` — only `'rotation'` (or legacy NULL) fires the
 * "defence in depth, kill the whole family" behaviour. Every other reason
 * represents a legitimate user/admin-initiated revocation; presenting a
 * token revoked under those reasons must NOT cascade or we'd kill the
 * keep-alive session on every `revokeAllOtherSessions` call.
 */
export type RefreshTokenRevokeReason =
  | 'rotation'
  | 'user_initiated'
  | 'password_change'
  | 'admin_revoked';

export abstract class RefreshTokenRepository {
  abstract create(data: CreateRefreshTokenData): Promise<void>;
  abstract findByIdWithRelations(id: string): Promise<RefreshTokenWithRelations | null>;
  abstract findByHash(tokenHash: string): Promise<{ id: string; userId: string } | null>;
  abstract findActiveByUserId(userId: string): Promise<RefreshTokenWithRelations[]>;
  abstract revoke(id: string, reason: RefreshTokenRevokeReason): Promise<void>;
  abstract revokeAllForUser(userId: string, reason: RefreshTokenRevokeReason): Promise<void>;
  abstract revokeAllOtherForUser(
    userId: string,
    currentTokenId: string,
    reason: RefreshTokenRevokeReason,
  ): Promise<void>;
}
