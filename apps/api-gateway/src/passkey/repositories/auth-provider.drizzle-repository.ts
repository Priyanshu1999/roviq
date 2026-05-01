import { Inject, Injectable } from '@nestjs/common';
import {
  authProviders,
  DRIZZLE_DB,
  type DrizzleDB,
  mkAdminCtx,
  users,
  withAdmin,
} from '@roviq/database';
import { and, count, desc, eq, ne } from 'drizzle-orm';
import { AuthProviderRepository } from './auth-provider.repository';
import type { AuthProviderRecord, CreatePasskeyData } from './types';

@Injectable()
export class AuthProviderDrizzleRepository extends AuthProviderRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async findPasskeysByUserId(userId: string): Promise<AuthProviderRecord[]> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      return tx
        .select({
          id: authProviders.id,
          userId: authProviders.userId,
          provider: authProviders.provider,
          providerUserId: authProviders.providerUserId,
          providerData: authProviders.providerData,
          createdAt: authProviders.createdAt,
        })
        .from(authProviders)
        .where(and(eq(authProviders.userId, userId), eq(authProviders.provider, 'passkey')))
        .orderBy(desc(authProviders.createdAt));
    });
  }

  async findByActiveUsername(username: string): Promise<AuthProviderRecord[]> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      return tx
        .select({
          id: authProviders.id,
          userId: authProviders.userId,
          provider: authProviders.provider,
          providerUserId: authProviders.providerUserId,
          providerData: authProviders.providerData,
          createdAt: authProviders.createdAt,
        })
        .from(authProviders)
        .innerJoin(users, eq(authProviders.userId, users.id))
        .where(
          and(
            eq(authProviders.provider, 'passkey'),
            eq(users.username, username),
            eq(users.status, 'ACTIVE'),
          ),
        );
    });
  }

  async findByCredentialId(credentialId: string): Promise<AuthProviderRecord | null> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const result = await tx
        .select({
          id: authProviders.id,
          userId: authProviders.userId,
          provider: authProviders.provider,
          providerUserId: authProviders.providerUserId,
          providerData: authProviders.providerData,
          createdAt: authProviders.createdAt,
        })
        .from(authProviders)
        .where(
          and(
            eq(authProviders.provider, 'passkey'),
            eq(authProviders.providerUserId, credentialId),
          ),
        )
        .limit(1);

      return result[0] ?? null;
    });
  }

  async create(data: CreatePasskeyData): Promise<AuthProviderRecord> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const result = await tx
        .insert(authProviders)
        .values({
          userId: data.userId,
          provider: data.provider,
          providerUserId: data.providerUserId,
          providerData: data.providerData,
        })
        .returning({
          id: authProviders.id,
          userId: authProviders.userId,
          provider: authProviders.provider,
          providerUserId: authProviders.providerUserId,
          providerData: authProviders.providerData,
          createdAt: authProviders.createdAt,
        });

      return result[0];
    });
  }

  async updateProviderData(id: string, data: unknown): Promise<void> {
    await withAdmin(this.db, mkAdminCtx(), async (tx) => {
      await tx.update(authProviders).set({ providerData: data }).where(eq(authProviders.id, id));
    });
  }

  async countOtherPasskeys(userId: string, excludeId: string): Promise<number> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const result = await tx
        .select({ count: count() })
        .from(authProviders)
        .where(
          and(
            eq(authProviders.userId, userId),
            eq(authProviders.provider, 'passkey'),
            ne(authProviders.id, excludeId),
          ),
        );

      return result[0].count;
    });
  }

  async deletePasskey(id: string, userId: string): Promise<number> {
    return withAdmin(this.db, mkAdminCtx(), async (tx) => {
      const result = await tx
        .delete(authProviders)
        .where(and(eq(authProviders.id, id), eq(authProviders.userId, userId)));

      return result.rowCount ?? 0;
    });
  }
}
