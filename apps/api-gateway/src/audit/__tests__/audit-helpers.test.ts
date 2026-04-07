import { describe, expect, it } from 'vitest';
import {
  computeDiff,
  extractActionType,
  extractEntityType,
  maskChanges,
  snapshotForDelete,
} from '../audit.helpers';

// ═══════════════════════════════════════════════════════
// computeDiff
// ═══════════════════════════════════════════════════════

describe('computeDiff', () => {
  // ── Basic field changes ───────────────────────────────

  describe('basic field changes', () => {
    it('detects a single changed field', () => {
      expect(computeDiff({ name: 'Raj' }, { name: 'Rajesh' })).toEqual({
        name: { old: 'Raj', new: 'Rajesh' },
      });
    });

    it('detects multiple changed fields', () => {
      expect(
        computeDiff(
          { name: 'Raj', email: 'raj@old.com', age: 20 },
          { name: 'Rajesh', email: 'raj@new.com', age: 21 },
        ),
      ).toEqual({
        name: { old: 'Raj', new: 'Rajesh' },
        email: { old: 'raj@old.com', new: 'raj@new.com' },
        age: { old: 20, new: 21 },
      });
    });

    it('excludes unchanged fields from result', () => {
      const diff = computeDiff(
        { name: 'Raj', email: 'same@test.com' },
        { name: 'Rajesh', email: 'same@test.com' },
      );
      expect(diff).toEqual({ name: { old: 'Raj', new: 'Rajesh' } });
      expect(diff).not.toHaveProperty('email');
    });

    it('returns null when nothing changed', () => {
      expect(computeDiff({ a: 1, b: 'two' }, { a: 1, b: 'two' })).toBeNull();
    });

    it('returns null for identical empty objects', () => {
      expect(computeDiff({}, {})).toBeNull();
    });
  });

  // ── Added / removed keys ──────────────────────────────

  describe('added and removed keys', () => {
    it('detects a new key (absent before → present after)', () => {
      expect(computeDiff({}, { name: 'New' })).toEqual({
        name: { old: null, new: 'New' },
      });
    });

    it('detects a removed key (present before → absent after)', () => {
      expect(computeDiff({ name: 'Old' }, {})).toEqual({
        name: { old: 'Old', new: null },
      });
    });

    it('handles simultaneous add and remove', () => {
      expect(computeDiff({ a: 1 }, { b: 2 })).toEqual({
        a: { old: 1, new: null },
        b: { old: null, new: 2 },
      });
    });

    it('handles add, remove, and change together', () => {
      expect(
        computeDiff(
          { keep: 'same', change: 'old', remove: 'gone' },
          { keep: 'same', change: 'new', add: 'fresh' },
        ),
      ).toEqual({
        change: { old: 'old', new: 'new' },
        remove: { old: 'gone', new: null },
        add: { old: null, new: 'fresh' },
      });
    });
  });

  // ── Null / undefined handling ─────────────────────────

  describe('null and undefined handling', () => {
    it('detects null → value change', () => {
      expect(computeDiff({ x: null }, { x: 'set' })).toEqual({
        x: { old: null, new: 'set' },
      });
    });

    it('detects value → null change', () => {
      expect(computeDiff({ x: 'set' }, { x: null })).toEqual({
        x: { old: 'set', new: null },
      });
    });

    it('treats null === null as unchanged', () => {
      expect(computeDiff({ x: null }, { x: null })).toBeNull();
    });

    it('treats undefined → undefined as unchanged', () => {
      expect(computeDiff({ x: undefined }, { x: undefined })).toBeNull();
    });

    it('treats null and undefined as equal (both map to null)', () => {
      expect(computeDiff({ x: null }, { x: undefined })).toBeNull();
    });

    it('normalizes undefined to null in output', () => {
      expect(computeDiff({}, { x: undefined })).toBeNull();
    });

    it('detects undefined → value change', () => {
      expect(computeDiff({ x: undefined }, { x: 'now set' })).toEqual({
        x: { old: null, new: 'now set' },
      });
    });
  });

  // ── Primitive types ───────────────────────────────────

  describe('primitive type changes', () => {
    it('detects boolean changes', () => {
      expect(computeDiff({ flag: false }, { flag: true })).toEqual({
        flag: { old: false, new: true },
      });
    });

    it('treats same booleans as unchanged', () => {
      expect(computeDiff({ flag: true }, { flag: true })).toBeNull();
    });

    it('detects number changes including zero', () => {
      expect(computeDiff({ count: 0 }, { count: 1 })).toEqual({
        count: { old: 0, new: 1 },
      });
    });

    it('treats same numbers as unchanged', () => {
      expect(computeDiff({ n: 42 }, { n: 42 })).toBeNull();
    });

    it('detects empty string vs non-empty string', () => {
      expect(computeDiff({ s: '' }, { s: 'filled' })).toEqual({
        s: { old: '', new: 'filled' },
      });
    });

    it('detects type change (number → string)', () => {
      expect(computeDiff({ x: 42 }, { x: '42' as unknown })).toEqual({
        x: { old: 42, new: '42' },
      });
    });

    it('detects type change (boolean → number)', () => {
      expect(computeDiff({ x: false }, { x: 0 as unknown })).toEqual({
        x: { old: false, new: 0 },
      });
    });
  });

  // ── Shallow object comparison ─────────────────────────

  describe('object comparison (JSON-based)', () => {
    it('treats identical objects as unchanged', () => {
      expect(computeDiff({ a: { b: 1 } }, { a: { b: 1 } })).toBeNull();
    });

    it('detects changed nested object', () => {
      expect(computeDiff({ a: { b: 1 } }, { a: { b: 2 } })).toEqual({
        a: { old: { b: 1 }, new: { b: 2 } },
      });
    });

    it('is key-order independent for objects', () => {
      expect(computeDiff({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 } })).toBeNull();
    });

    it('detects added key in nested object', () => {
      expect(computeDiff({ a: { x: 1 } }, { a: { x: 1, y: 2 } })).toEqual({
        a: { old: { x: 1 }, new: { x: 1, y: 2 } },
      });
    });

    it('detects removed key in nested object', () => {
      expect(computeDiff({ a: { x: 1, y: 2 } }, { a: { x: 1 } })).toEqual({
        a: { old: { x: 1, y: 2 }, new: { x: 1 } },
      });
    });
  });

  // ── Deep nesting ──────────────────────────────────────

  describe('deeply nested objects', () => {
    it('detects change 3 levels deep', () => {
      const before = {
        config: { notifications: { email: { enabled: true, frequency: 'daily' } } },
      };
      const after = {
        config: { notifications: { email: { enabled: true, frequency: 'weekly' } } },
      };
      const diff = computeDiff(before, after);
      expect(diff).toEqual({
        config: { old: before.config, new: after.config },
      });
    });

    it('treats identical deeply nested structures as unchanged', () => {
      const obj = { a: { b: { c: { d: { e: 'deep' } } } } };
      expect(computeDiff(obj, JSON.parse(JSON.stringify(obj)))).toBeNull();
    });

    it('is key-order independent at all nesting levels', () => {
      const before = { meta: { b: 2, a: { d: 4, c: 3 } } };
      const after = { meta: { a: { c: 3, d: 4 }, b: 2 } };
      expect(computeDiff(before, after)).toBeNull();
    });

    it('detects change in nested i18n JSONB field', () => {
      const before = { name: { en: 'Science', hi: 'विज्ञान' } };
      const after = { name: { en: 'Advanced Science', hi: 'उन्नत विज्ञान' } };
      expect(computeDiff(before, after)).toEqual({
        name: { old: before.name, new: after.name },
      });
    });

    it('treats same i18n with different key order as unchanged', () => {
      expect(
        computeDiff({ name: { en: 'X', hi: 'Y' } }, { name: { hi: 'Y', en: 'X' } }),
      ).toBeNull();
    });
  });

  // ── Arrays ────────────────────────────────────────────

  describe('array comparison', () => {
    it('treats identical arrays as unchanged', () => {
      expect(computeDiff({ tags: [1, 2, 3] }, { tags: [1, 2, 3] })).toBeNull();
    });

    it('detects changed array elements', () => {
      expect(computeDiff({ tags: [1, 2] }, { tags: [1, 3] })).toEqual({
        tags: { old: [1, 2], new: [1, 3] },
      });
    });

    it('detects added array element', () => {
      expect(computeDiff({ tags: [1] }, { tags: [1, 2] })).toEqual({
        tags: { old: [1], new: [1, 2] },
      });
    });

    it('detects removed array element', () => {
      expect(computeDiff({ tags: [1, 2] }, { tags: [1] })).toEqual({
        tags: { old: [1, 2], new: [1] },
      });
    });

    it('detects reordered array as changed (order-sensitive)', () => {
      expect(computeDiff({ tags: [1, 2] }, { tags: [2, 1] })).toEqual({
        tags: { old: [1, 2], new: [2, 1] },
      });
    });

    it('treats empty arrays as unchanged', () => {
      expect(computeDiff({ items: [] }, { items: [] })).toBeNull();
    });

    it('detects empty → non-empty array', () => {
      expect(computeDiff({ items: [] }, { items: ['a'] })).toEqual({
        items: { old: [], new: ['a'] },
      });
    });

    it('handles array of objects', () => {
      const before = { abilities: [{ action: 'read', subject: 'Student' }] };
      const after = {
        abilities: [
          { action: 'read', subject: 'Student' },
          { action: 'manage', subject: 'Attendance' },
        ],
      };
      expect(computeDiff(before, after)).toEqual({
        abilities: { old: before.abilities, new: after.abilities },
      });
    });

    it('treats identical arrays of objects as unchanged', () => {
      const arr = [{ a: 1 }, { b: 2 }];
      expect(computeDiff({ x: arr }, { x: JSON.parse(JSON.stringify(arr)) })).toBeNull();
    });
  });

  // ── Real-world billing payloads ───────────────────────

  describe('real-world payloads', () => {
    it('detects subscription plan changes with featureLimits', () => {
      const before = {
        name: { en: 'Basic', hi: 'बेसिक' },
        amount: 99900,
        featureLimits: { maxStudents: 100, maxTeachers: 10, smsEnabled: false },
      };
      const after = {
        name: { en: 'Basic', hi: 'बेसिक' },
        amount: 149900,
        featureLimits: { maxStudents: 250, maxTeachers: 25, smsEnabled: true },
      };
      const diff = computeDiff(before, after);
      expect(diff).toEqual({
        amount: { old: 99900, new: 149900 },
        featureLimits: { old: before.featureLimits, new: after.featureLimits },
      });
      // name unchanged
      expect(diff).not.toHaveProperty('name');
    });

    it('detects institute settings change with nested contact/address', () => {
      const before = {
        name: { en: 'DPS' },
        contact: { email: 'old@dps.edu', phone: '+919876543210' },
        address: { city: 'Delhi', pin: '110001' },
      };
      const after = {
        name: { en: 'DPS' },
        contact: { email: 'new@dps.edu', phone: '+919876543210' },
        address: { city: 'Delhi', pin: '110001' },
      };
      const diff = computeDiff(before, after);
      expect(diff).toEqual({
        contact: { old: before.contact, new: after.contact },
      });
      expect(diff).not.toHaveProperty('name');
      expect(diff).not.toHaveProperty('address');
    });

    it('handles membership status transition', () => {
      const diff = computeDiff(
        { status: 'ACTIVE', suspendedAt: null },
        { status: 'SUSPENDED', suspendedAt: '2026-03-24T10:00:00Z' },
      );
      expect(diff).toEqual({
        status: { old: 'ACTIVE', new: 'SUSPENDED' },
        suspendedAt: { old: null, new: '2026-03-24T10:00:00Z' },
      });
    });
  });

  // ── Large payloads / stress ───────────────────────────

  describe('large payloads', () => {
    it('handles 100 fields with only 1 changed', () => {
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        before[`field_${i}`] = `value_${i}`;
        after[`field_${i}`] = `value_${i}`;
      }
      after.field_50 = 'changed';

      const diff = computeDiff(before, after);
      expect(diff).toEqual({ field_50: { old: 'value_50', new: 'changed' } });
    });

    it('handles all fields changed', () => {
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      for (let i = 0; i < 50; i++) {
        before[`f${i}`] = i;
        after[`f${i}`] = i + 100;
      }
      const diff = computeDiff(before, after)!;
      expect(Object.keys(diff).length).toBe(50);
    });
  });
});

// ═══════════════════════════════════════════════════════
// snapshotForDelete
// ═══════════════════════════════════════════════════════

describe('snapshotForDelete', () => {
  it('maps every field to { old: value, new: null }', () => {
    expect(snapshotForDelete({ name: 'Raj', email: 'a@b.com' })).toEqual({
      name: { old: 'Raj', new: null },
      email: { old: 'a@b.com', new: null },
    });
  });

  it('handles empty entity', () => {
    expect(snapshotForDelete({})).toEqual({});
  });

  it('preserves nested objects in old value', () => {
    const entity = {
      name: 'Test',
      settings: { theme: 'dark', notifications: { email: true } },
      tags: ['a', 'b'],
    };
    const snapshot = snapshotForDelete(entity);
    expect(snapshot.settings).toEqual({
      old: { theme: 'dark', notifications: { email: true } },
      new: null,
    });
    expect(snapshot.tags).toEqual({ old: ['a', 'b'], new: null });
  });

  it('handles various primitive types', () => {
    const snapshot = snapshotForDelete({
      str: 'text',
      num: 42,
      bool: true,
      nil: null,
      zero: 0,
      empty: '',
    });
    expect(snapshot.str).toEqual({ old: 'text', new: null });
    expect(snapshot.num).toEqual({ old: 42, new: null });
    expect(snapshot.bool).toEqual({ old: true, new: null });
    expect(snapshot.nil).toEqual({ old: null, new: null });
    expect(snapshot.zero).toEqual({ old: 0, new: null });
    expect(snapshot.empty).toEqual({ old: '', new: null });
  });

  it('handles i18n JSONB field', () => {
    const snapshot = snapshotForDelete({ name: { en: 'Science', hi: 'विज्ञान' } });
    expect(snapshot.name).toEqual({
      old: { en: 'Science', hi: 'विज्ञान' },
      new: null,
    });
  });
});

// ═══════════════════════════════════════════════════════
// maskChanges
// ═══════════════════════════════════════════════════════

describe('maskChanges', () => {
  it('replaces masked field values with [REDACTED]', () => {
    const changes = {
      name: { old: 'Raj', new: 'Rajesh' },
      password: { old: 'secret', new: 'newsecret' },
    };
    expect(maskChanges(changes, ['password'])).toEqual({
      name: { old: 'Raj', new: 'Rajesh' },
      password: { old: '[REDACTED]', new: '[REDACTED]' },
    });
  });

  it('returns same reference when no masked fields', () => {
    const changes = { name: { old: 'a', new: 'b' } };
    expect(maskChanges(changes, [])).toBe(changes);
  });

  it('masks multiple fields', () => {
    const changes = {
      name: { old: 'Raj', new: 'Rajesh' },
      password: { old: 'p1', new: 'p2' },
      apiKey: { old: 'key1', new: 'key2' },
    };
    const result = maskChanges(changes, ['password', 'apiKey']);
    expect(result.name).toEqual({ old: 'Raj', new: 'Rajesh' });
    expect(result.password).toEqual({ old: '[REDACTED]', new: '[REDACTED]' });
    expect(result.apiKey).toEqual({ old: '[REDACTED]', new: '[REDACTED]' });
  });

  it('ignores masked field names not present in changes', () => {
    const changes = { name: { old: 'a', new: 'b' } };
    const result = maskChanges(changes, ['nonexistent']);
    expect(result).toEqual({ name: { old: 'a', new: 'b' } });
  });

  it('does not mutate the original changes object', () => {
    const changes = {
      name: { old: 'a', new: 'b' },
      secret: { old: 's1', new: 's2' },
    };
    const original = JSON.parse(JSON.stringify(changes));
    maskChanges(changes, ['secret']);
    expect(changes.secret).toEqual(original.secret);
  });

  it('masks nested object values entirely', () => {
    const changes = {
      credentials: {
        old: { key: 'abc', secret: 'xyz' },
        new: { key: 'def', secret: 'uvw' },
      },
    };
    const result = maskChanges(changes, ['credentials']);
    expect(result.credentials).toEqual({ old: '[REDACTED]', new: '[REDACTED]' });
  });
});

// ═══════════════════════════════════════════════════════
// extractActionType
// ═══════════════════════════════════════════════════════

describe('extractActionType', () => {
  it.each([
    ['createStudent', 'CREATE'],
    ['updateInstitute', 'UPDATE'],
    ['deleteRole', 'DELETE'],
    ['restoreMembership', 'RESTORE'],
    ['assignTeacherToSection', 'ASSIGN'],
    ['revokeSession', 'REVOKE'],
    ['suspendInstitute', 'SUSPEND'],
    ['activateUser', 'ACTIVATE'],
  ])('%s → %s', (input, expected) => {
    expect(extractActionType(input)).toBe(expected);
  });

  it('falls back to UPDATE for unrecognized prefixes', () => {
    expect(extractActionType('doSomething')).toBe('UPDATE');
    expect(extractActionType('customMutation')).toBe('UPDATE');
    expect(extractActionType('loginUser')).toBe('UPDATE');
  });

  it('handles empty string', () => {
    expect(extractActionType('')).toBe('UPDATE');
  });

  it('is case-sensitive (uppercase prefix not matched)', () => {
    expect(extractActionType('CreateStudent')).toBe('UPDATE');
    expect(extractActionType('DELETE_role')).toBe('UPDATE');
  });

  it('matches longest prefix first (activate before act)', () => {
    expect(extractActionType('activateUser')).toBe('ACTIVATE');
  });

  it('handles prefix-only mutation name', () => {
    // "create" alone — startsWith matches
    expect(extractActionType('create')).toBe('CREATE');
  });
});

// ═══════════════════════════════════════════════════════
// extractEntityType
// ═══════════════════════════════════════════════════════

describe('extractEntityType', () => {
  it.each([
    ['createStudent', 'Student'],
    ['updateInstitute', 'Institute'],
    ['deleteRole', 'Role'],
    ['restoreMembership', 'Membership'],
    ['assignTeacherToSection', 'TeacherToSection'],
    ['suspendInstitute', 'Institute'],
    ['activateUser', 'User'],
  ])('%s → %s', (input, expected) => {
    expect(extractEntityType(input)).toBe(expected);
  });

  describe('scope prefix stripping', () => {
    it('strips admin prefix', () => {
      expect(extractEntityType('adminCreateInstitute')).toBe('Institute');
    });

    it('strips reseller prefix', () => {
      expect(extractEntityType('resellerSuspendInstitute')).toBe('Institute');
    });

    it('strips institute prefix', () => {
      expect(extractEntityType('instituteUpdateSection')).toBe('Section');
    });

    it('does not strip prefix when next char is lowercase', () => {
      // "administrator" should NOT strip "admin" since 'i' is lowercase
      expect(extractEntityType('administrator')).toBe('Administrator');
    });

    it('does not strip "reseller" from "resellers"', () => {
      expect(extractEntityType('resellers')).toBe('Resellers');
    });
  });

  it('capitalizes first letter when no recognized action prefix', () => {
    expect(extractEntityType('customMutation')).toBe('CustomMutation');
    expect(extractEntityType('loginUser')).toBe('LoginUser');
  });

  it('handles action prefix only (no entity part after prefix)', () => {
    // "create" → prefix stripped leaves empty, returns capitalized original
    // Actually length check: name.length > prefix.length fails, so falls through
    expect(extractEntityType('create')).toBe('Create');
  });
});
