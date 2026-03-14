import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AbilityFactory } from '../ability.factory';

function createMockRedis() {
  return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
}

function createMockRoleRepo() {
  return { findAbilities: vi.fn() };
}

function createMockMembershipAbilityRepo() {
  return { findAbilities: vi.fn() };
}

describe('AbilityFactory', () => {
  let factory: AbilityFactory;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockRoleRepo: ReturnType<typeof createMockRoleRepo>;
  let mockMembershipAbilityRepo: ReturnType<typeof createMockMembershipAbilityRepo>;

  beforeEach(() => {
    mockRedis = createMockRedis();
    mockRoleRepo = createMockRoleRepo();
    mockMembershipAbilityRepo = createMockMembershipAbilityRepo();
    factory = new AbilityFactory(
      mockRedis as unknown as import('ioredis').default,
      mockRoleRepo as unknown as import('../repositories/role.repository').RoleRepository,
      mockMembershipAbilityRepo as unknown as import('../repositories/membership-ability.repository').MembershipAbilityRepository,
    );
  });

  describe('getRoleAbilities', () => {
    it('should return cached abilities when available', async () => {
      const cachedAbilities = [{ action: 'read', subject: 'Student' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedAbilities));

      const result = await factory.getRoleAbilities('role-1');

      expect(result).toEqual(cachedAbilities);
      expect(mockRoleRepo.findAbilities).not.toHaveBeenCalled();
    });

    it('should fetch from DB and cache when not in Redis', async () => {
      const dbAbilities = [{ action: 'manage', subject: 'all' }];
      mockRedis.get.mockResolvedValue(null);
      mockRoleRepo.findAbilities.mockResolvedValue({
        abilities: dbAbilities,
      });

      const result = await factory.getRoleAbilities('role-1');

      expect(result).toEqual(dbAbilities);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'casl:role:role-1',
        JSON.stringify(dbAbilities),
        'EX',
        300,
      );
    });

    it('should return empty array when role not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRoleRepo.findAbilities.mockResolvedValue(null);

      const result = await factory.getRoleAbilities('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('createForUser', () => {
    it('should combine role abilities and user abilities', async () => {
      const roleAbilities = [{ action: 'read', subject: 'Student' }];
      const userAbilities = [{ action: 'create', subject: 'Timetable' }];

      mockRedis.get.mockResolvedValue(JSON.stringify(roleAbilities));
      mockMembershipAbilityRepo.findAbilities.mockResolvedValue({
        abilities: userAbilities,
      });

      const ability = await factory.createForUser({
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
      });

      expect(ability.can('read', 'Student')).toBe(true);
      expect(ability.can('create', 'Timetable')).toBe(true);
      expect(ability.can('delete', 'Student')).toBe(false);
    });

    it('should work with only role abilities when user has none', async () => {
      const roleAbilities = [{ action: 'manage', subject: 'all' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(roleAbilities));
      mockMembershipAbilityRepo.findAbilities.mockResolvedValue({ abilities: null });

      const ability = await factory.createForUser({
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
      });

      expect(ability.can('manage', 'all')).toBe(true);
    });

    it('should resolve ${user.id} placeholders in conditions', async () => {
      const roleAbilities = [
        {
          action: 'read',
          subject: 'Attendance',
          conditions: { studentId: '${user.id}' },
        },
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(roleAbilities));
      mockMembershipAbilityRepo.findAbilities.mockResolvedValue({ abilities: null });

      const ability = await factory.createForUser({
        userId: 'user-42',
        tenantId: 'tenant-1',
        roleId: 'role-1',
      });

      // The condition should be resolved to the actual user ID
      const rules = ability.rules;
      const attendanceRule = rules.find((r) => r.subject === 'Attendance');
      expect(attendanceRule?.conditions).toEqual({ studentId: 'user-42' });
    });

    it('should resolve ${user.tenantId} placeholders in conditions', async () => {
      const roleAbilities = [
        {
          action: 'read',
          subject: 'Organization',
          conditions: { id: '${user.tenantId}' },
        },
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(roleAbilities));
      mockMembershipAbilityRepo.findAbilities.mockResolvedValue({ abilities: null });

      const ability = await factory.createForUser({
        userId: 'user-1',
        tenantId: 'tenant-99',
        roleId: 'role-1',
      });

      const rules = ability.rules;
      const orgRule = rules.find((r) => r.subject === 'Organization');
      expect(orgRule?.conditions).toEqual({ id: 'tenant-99' });
    });

    it('should resolve multiple placeholders in nested conditions', async () => {
      const roleAbilities = [
        {
          action: 'read',
          subject: 'Attendance',
          conditions: {
            studentId: '${user.id}',
            organization: { id: '${user.tenantId}' },
          },
        },
      ];
      mockRedis.get.mockResolvedValue(JSON.stringify(roleAbilities));
      mockMembershipAbilityRepo.findAbilities.mockResolvedValue({ abilities: null });

      const ability = await factory.createForUser({
        userId: 'user-42',
        tenantId: 'tenant-99',
        roleId: 'role-1',
      });

      const rule = ability.rules.find((r) => r.subject === 'Attendance');
      expect(rule?.conditions).toEqual({
        studentId: 'user-42',
        organization: { id: 'tenant-99' },
      });
    });

    it('should handle user record not found gracefully', async () => {
      const roleAbilities = [{ action: 'read', subject: 'Student' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(roleAbilities));
      mockMembershipAbilityRepo.findAbilities.mockResolvedValue(null);

      const ability = await factory.createForUser({
        userId: 'deleted-user',
        tenantId: 'tenant-1',
        roleId: 'role-1',
      });

      expect(ability.can('read', 'Student')).toBe(true);
      expect(ability.rules).toHaveLength(1);
    });

    it('should treat user abilities as empty array when field is null', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify([{ action: 'read', subject: 'Student' }]));
      mockMembershipAbilityRepo.findAbilities.mockResolvedValue({ abilities: null });

      const ability = await factory.createForUser({
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
      });

      expect(ability.rules).toHaveLength(1);
    });

    it('should propagate Redis connection errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        factory.createForUser({
          userId: 'user-1',
          tenantId: 'tenant-1',
          roleId: 'role-1',
        }),
      ).rejects.toThrow('ECONNREFUSED');
    });

    it('should pass through rules without conditions unchanged', async () => {
      const roleAbilities = [{ action: 'read', subject: 'Student' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(roleAbilities));
      mockMembershipAbilityRepo.findAbilities.mockResolvedValue({ abilities: null });

      const ability = await factory.createForUser({
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
      });

      expect(ability.rules[0].conditions).toBeUndefined();
    });
  });

  describe('invalidateRoleCache', () => {
    it('should delete the cached role from Redis', async () => {
      await factory.invalidateRoleCache('role-1');

      expect(mockRedis.del).toHaveBeenCalledWith('casl:role:role-1');
    });
  });
});
