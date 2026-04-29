import { createMongoAbility } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import type { AppAbility } from '../lib/common-types';
import { AppAction, AppSubject, DEFAULT_ROLE_ABILITIES, DefaultRoles } from '../lib/common-types';

describe('AppAction', () => {
  it('should define all CRUD actions plus manage', () => {
    expect(AppAction.Manage).toBe('manage');
    expect(AppAction.Create).toBe('create');
    expect(AppAction.Read).toBe('read');
    expect(AppAction.Update).toBe('update');
    expect(AppAction.Delete).toBe('delete');
  });
});

describe('AppSubject', () => {
  it('should include all core domain subjects', () => {
    expect(AppSubject.All).toBe('all');
    expect(AppSubject.Institute).toBe('Institute');
    expect(AppSubject.User).toBe('User');
    expect(AppSubject.Student).toBe('Student');
    expect(AppSubject.Attendance).toBe('Attendance');
    expect(AppSubject.Timetable).toBe('Timetable');
    expect(AppSubject.Bot).toBe('Bot');
    expect(AppSubject.Consent).toBe('Consent');
  });
});

describe('DefaultRoles', () => {
  it('should include core roles', () => {
    const values = Object.values(DefaultRoles);
    expect(values).toContain('institute_admin');
    expect(values).toContain('class_teacher');
    expect(values).toContain('student');
    expect(values).toContain('parent');
    expect(values).toContain('principal');
    expect(values).toContain('it_admin');
  });

  it('should have abilities defined for every default role', () => {
    for (const role of Object.values(DefaultRoles)) {
      expect(DEFAULT_ROLE_ABILITIES[role]).toBeDefined();
      expect(Array.isArray(DEFAULT_ROLE_ABILITIES[role])).toBe(true);
    }
  });
});

describe('DEFAULT_ROLE_ABILITIES with CASL', () => {
  it('institute_admin can manage everything', () => {
    const ability = createMongoAbility<AppAbility>(DEFAULT_ROLE_ABILITIES.institute_admin);
    expect(ability.can('manage', 'all')).toBe(true);
    expect(ability.can('create', 'Student')).toBe(true);
    expect(ability.can('delete', 'Attendance')).toBe(true);
  });

  it('class_teacher can read students and manage attendance in their sections', () => {
    const ability = createMongoAbility<AppAbility>(DEFAULT_ROLE_ABILITIES.class_teacher);
    expect(ability.can('read', 'Student')).toBe(true);
    expect(ability.can('manage', 'Attendance')).toBe(true);
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('student can read timetable and subjects but not create anything', () => {
    const ability = createMongoAbility<AppAbility>(DEFAULT_ROLE_ABILITIES.student);
    expect(ability.can('read', 'Timetable')).toBe(true);
    expect(ability.can('read', 'Subject')).toBe(true);
    expect(ability.can('create', 'Attendance')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('student attendance has condition placeholder for self-only access', () => {
    const attendanceRule = DEFAULT_ROLE_ABILITIES.student.find((r) => r.subject === 'Attendance');
    expect(attendanceRule).toBeDefined();
    expect(attendanceRule?.conditions).toBeDefined();
  });

  it('parent can read students and manage consent', () => {
    const ability = createMongoAbility<AppAbility>(DEFAULT_ROLE_ABILITIES.parent);
    expect(ability.can('read', 'Student')).toBe(true);
    expect(ability.can('read', 'Attendance')).toBe(true);
    expect(ability.can('manage', 'Consent')).toBe(true);
    expect(ability.can('create', 'Student')).toBe(false);
  });

  it('it_admin can manage bots', () => {
    const ability = createMongoAbility<AppAbility>(DEFAULT_ROLE_ABILITIES.it_admin);
    expect(ability.can('manage', 'Bot')).toBe(true);
  });

  // CR-001: every CASL subject used by `@CheckAbility(action, 'Foo')` in the
  // gateway must have at least one role in DEFAULT_ROLE_ABILITIES with read
  // (or higher) access — otherwise shipping a feature locks every institute
  // role out of it ("forbidden for everyone except platform admin"). The
  // `institute_admin` carries `manage all` which transitively covers every
  // subject; this test asserts that fact for every value of AppSubject so a
  // future change to remove the wildcard immediately fails CI.
  it('every AppSubject is reachable by at least one default role', () => {
    const adminAbility = createMongoAbility<AppAbility>(DEFAULT_ROLE_ABILITIES.institute_admin);
    for (const subject of Object.values(AppSubject)) {
      // `all` is the wildcard itself — skip.
      if (subject === AppSubject.All) continue;
      expect(
        adminAbility.can('read', subject),
        `institute_admin should read AppSubject.${subject}`,
      ).toBe(true);
      expect(
        adminAbility.can('manage', subject),
        `institute_admin should manage AppSubject.${subject}`,
      ).toBe(true);
    }
  });
});
