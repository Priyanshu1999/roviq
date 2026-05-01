/**
 * Unit tests for InstituteRoleService — covers list/findById passthrough and
 * the order-sensitive write path: `updatePrimaryNavSlugs(roleId, slugs)` MUST
 * call `repo.updatePrimaryNavSlugs` BEFORE `abilityFactory.invalidateRoleCache`.
 *
 * Cache invalidation before the DB write would create a window where a
 * concurrent /me call repopulates the cache with stale row data, defeating
 * the bust. The order assertion below guards against that regression.
 *
 * Mirrors the holiday.service.spec.ts pattern: dependencies are produced via
 * `createMock<T>()` and the service is constructed via `Object.create(Proto)`
 * so we skip the real constructor (parameter-property shorthand under
 * esbuild/Vitest does not reliably wire private fields).
 */

import type { AbilityFactory } from '@roviq/casl';
import { createMock } from '@roviq/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstituteRoleRepository } from '../repositories/role.repository';
import type { RoleRecord } from '../repositories/types';
import { InstituteRoleService } from '../role.service';

const TENANT_ID = '00000000-0000-7000-a000-000000000101';
const ROLE_ID = '00000000-0000-7000-a000-000000000301';

function buildRole(overrides: Partial<RoleRecord> = {}): RoleRecord {
  return {
    id: ROLE_ID,
    tenantId: TENANT_ID,
    name: { en: 'Class Teacher' },
    isDefault: false,
    isSystem: false,
    primaryNavSlugs: [],
    ...overrides,
  };
}

describe('InstituteRoleService (unit)', () => {
  let service: InstituteRoleService;
  let repo: ReturnType<typeof createMock<InstituteRoleRepository>>;
  let abilityFactory: ReturnType<typeof createMock<AbilityFactory>>;

  beforeEach(() => {
    repo = createMock<InstituteRoleRepository>({
      list: vi.fn(),
      findById: vi.fn(),
      updatePrimaryNavSlugs: vi.fn(),
    });
    abilityFactory = createMock<AbilityFactory>({
      invalidateRoleCache: vi.fn(),
    });
    // Skip the real constructor: parameter-property shorthand under
    // esbuild/Vitest does not reliably wire private fields, leaving them
    // undefined.
    service = Object.assign(Object.create(InstituteRoleService.prototype), {
      repo,
      abilityFactory,
    });
  });

  describe('list', () => {
    it('proxies to repo.list and returns the result unchanged', async () => {
      const rows = [buildRole(), buildRole({ id: '00000000-0000-7000-a000-000000000302' })];
      repo.list.mockResolvedValue(rows);

      const result = await service.list();

      expect(result).toBe(rows);
      expect(repo.list).toHaveBeenCalledWith();
      expect(repo.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('findById', () => {
    it('proxies to repo.findById with the given id and returns the row', async () => {
      const row = buildRole();
      repo.findById.mockResolvedValue(row);

      const result = await service.findById(ROLE_ID);

      expect(result).toBe(row);
      expect(repo.findById).toHaveBeenCalledWith(ROLE_ID);
    });

    it('returns null when the repo returns null (no NotFoundException)', async () => {
      repo.findById.mockResolvedValue(null);

      const result = await service.findById(ROLE_ID);

      expect(result).toBeNull();
    });
  });

  describe('updatePrimaryNavSlugs', () => {
    it('writes via repo and busts the role-abilities cache, returning the updated row', async () => {
      const slugs = ['dashboard', 'students', 'attendance', 'profile'];
      const updated = buildRole({ primaryNavSlugs: slugs });
      repo.updatePrimaryNavSlugs.mockResolvedValue(updated);
      abilityFactory.invalidateRoleCache.mockResolvedValue(undefined);

      const result = await service.updatePrimaryNavSlugs(ROLE_ID, slugs);

      expect(result).toBe(updated);
      expect(repo.updatePrimaryNavSlugs).toHaveBeenCalledWith(ROLE_ID, slugs);
      expect(abilityFactory.invalidateRoleCache).toHaveBeenCalledWith(ROLE_ID);
    });

    it('calls repo.updatePrimaryNavSlugs BEFORE abilityFactory.invalidateRoleCache', async () => {
      // Bust-before-write would create a stale-cache window: a concurrent
      // /me call could repopulate the cache with old row data after the
      // del() but before the UPDATE commits, defeating the invalidation.
      // The service must write first, then bust.
      const callOrder: string[] = [];
      repo.updatePrimaryNavSlugs.mockImplementation(async () => {
        callOrder.push('repo.update');
        return buildRole({ primaryNavSlugs: [] });
      });
      abilityFactory.invalidateRoleCache.mockImplementation(async () => {
        callOrder.push('abilityFactory.invalidate');
      });

      await service.updatePrimaryNavSlugs(ROLE_ID, []);

      expect(callOrder).toEqual(['repo.update', 'abilityFactory.invalidate']);
    });

    it('propagates the error and skips cache invalidation when the repo write fails', async () => {
      const dbError = new Error('row not found');
      repo.updatePrimaryNavSlugs.mockRejectedValue(dbError);

      await expect(service.updatePrimaryNavSlugs(ROLE_ID, ['dashboard'])).rejects.toBe(dbError);
      expect(abilityFactory.invalidateRoleCache).not.toHaveBeenCalled();
    });

    it('forwards an empty slugs array unchanged (clears the customization)', async () => {
      const updated = buildRole({ primaryNavSlugs: [] });
      repo.updatePrimaryNavSlugs.mockResolvedValue(updated);

      const result = await service.updatePrimaryNavSlugs(ROLE_ID, []);

      expect(repo.updatePrimaryNavSlugs).toHaveBeenCalledWith(ROLE_ID, []);
      expect(result.primaryNavSlugs).toEqual([]);
    });
  });
});
