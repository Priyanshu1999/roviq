import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, mkAdminCtx, users, withAdmin } from '@roviq/database';
import { eq, sql } from 'drizzle-orm';
import type { CreateUserData, UserRecord } from './types';
import { UserRepository } from './user.repository';

const userSelect = {
  id: users.id,
  username: users.username,
  email: users.email,
  passwordHash: users.passwordHash,
  status: users.status,
  passwordChangedAt: users.passwordChangedAt,
  mustChangePassword: users.mustChangePassword,
} as const;

@Injectable()
export class UserDrizzleRepository extends UserRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async create(data: CreateUserData): Promise<UserRecord> {
    const [user] = await withAdmin(this.db, mkAdminCtx(), (tx) =>
      tx
        .insert(users)
        .values({
          username: data.username,
          email: data.email,
          passwordHash: data.passwordHash,
        })
        .returning(userSelect),
    );
    return user;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [user] = await withAdmin(this.db, mkAdminCtx(), (tx) =>
      tx.select(userSelect).from(users).where(eq(users.id, id)).limit(1),
    );
    return user ?? null;
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const [user] = await withAdmin(this.db, mkAdminCtx(), (tx) =>
      tx.select(userSelect).from(users).where(eq(users.username, username)).limit(1),
    );
    return user ?? null;
  }

  async updatePasswordHash(id: string, passwordHash: string, changedAt: Date): Promise<void> {
    await withAdmin(this.db, mkAdminCtx(), (tx) =>
      tx.update(users).set({ passwordHash, passwordChangedAt: changedAt }).where(eq(users.id, id)),
    );
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await withAdmin(this.db, mkAdminCtx(), (tx) =>
      tx
        .update(users)
        .set({
          passwordHash,
          passwordChangedAt: sql`now()`,
          mustChangePassword: false,
        })
        .where(eq(users.id, userId)),
    );
  }
}
