import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB, type DrizzleDB, users, withAdmin } from '@roviq/database';
import { eq } from 'drizzle-orm';
import type { CreateUserData, UserRecord } from './types';
import { UserRepository } from './user.repository';

const userSelect = {
  id: users.id,
  username: users.username,
  email: users.email,
  passwordHash: users.passwordHash,
  status: users.status,
  isPlatformAdmin: users.isPlatformAdmin,
  passwordChangedAt: users.passwordChangedAt,
} as const;

@Injectable()
export class UserDrizzleRepository extends UserRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDB) {
    super();
  }

  async create(data: CreateUserData): Promise<UserRecord> {
    const [user] = await withAdmin(this.db, (tx) =>
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
    const [user] = await withAdmin(this.db, (tx) =>
      tx.select(userSelect).from(users).where(eq(users.id, id)).limit(1),
    );
    return user ?? null;
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const [user] = await withAdmin(this.db, (tx) =>
      tx.select(userSelect).from(users).where(eq(users.username, username)).limit(1),
    );
    return user ?? null;
  }
}
