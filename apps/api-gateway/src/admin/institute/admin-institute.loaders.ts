/**
 * Request-scoped DataLoader bundle for the admin institute field resolver.
 *
 * A new instance is constructed per GraphQL request (Nest DI with
 * `Scope.REQUEST`). Every `@ResolveField` that calls `.load(id)` within the
 * same request batches into a single DB query per field — keeping a page of
 * N institutes at a constant 2 extra round-trips regardless of N.
 *
 * Request scope is the correct boundary here: DataLoader must not be shared
 * across requests (cache leaks, stale auth context) and must not be reset
 * between field resolutions on the same request.
 */
import { Inject, Injectable, Scope } from '@nestjs/common';
import {
  DRIZZLE_DB,
  type DrizzleDB,
  instituteGroupsLive,
  mkAdminCtx,
  resellersLive,
  withAdmin,
} from '@roviq/database';
import DataLoader from 'dataloader';
import { inArray } from 'drizzle-orm';

@Injectable({ scope: Scope.REQUEST })
export class AdminInstituteLoaders {
  readonly resellerName: DataLoader<string, string | null>;
  readonly groupName: DataLoader<string, string | null>;

  constructor(@Inject(DRIZZLE_DB) db: DrizzleDB) {
    this.resellerName = new DataLoader<string, string | null>(async (ids) => {
      const idList = [...new Set(ids)] as string[];
      const rows = await withAdmin(db, mkAdminCtx('loader:admin-institute'), (tx) =>
        tx
          .select({ id: resellersLive.id, name: resellersLive.name })
          .from(resellersLive)
          .where(inArray(resellersLive.id, idList)),
      );
      const byId = new Map(rows.map((r) => [r.id, r.name]));
      return ids.map((id) => byId.get(id) ?? null);
    });

    this.groupName = new DataLoader<string, string | null>(async (ids) => {
      const idList = [...new Set(ids)] as string[];
      const rows = await withAdmin(db, mkAdminCtx('loader:admin-institute'), (tx) =>
        tx
          .select({ id: instituteGroupsLive.id, name: instituteGroupsLive.name })
          .from(instituteGroupsLive)
          .where(inArray(instituteGroupsLive.id, idList)),
      );
      const byId = new Map(
        rows.map((r) => {
          const raw = r.name;
          if (!raw) return [r.id, null] as const;
          if (typeof raw === 'string') return [r.id, raw] as const;
          return [r.id, (raw as Record<string, string>).en ?? null] as const;
        }),
      );
      return ids.map((id) => byId.get(id) ?? null);
    });
  }
}
