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
  });
});

describe('DefaultRoles', () => {
  it('should define all four default roles', () => {
    expect(Object.values(DefaultRoles)).toEqual([
      'institute_admin',
      'teacher',
      'student',
      'parent',
    ]);
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

  it('teacher can read students and CRUD attendance, but not delete students', () => {
    const ability = createMongoAbility<AppAbility>(DEFAULT_ROLE_ABILITIES.teacher);
    expect(ability.can('read', 'Student')).toBe(true);
    expect(ability.can('create', 'Attendance')).toBe(true);
    expect(ability.can('read', 'Attendance')).toBe(true);
    expect(ability.can('update', 'Attendance')).toBe(true);
    expect(ability.can('delete', 'Attendance')).toBe(false);
    expect(ability.can('delete', 'Student')).toBe(false);
    expect(ability.can('create', 'Student')).toBe(false);
  });

  it('student can read timetable and subjects but not create anything', () => {
    const ability = createMongoAbility<AppAbility>(DEFAULT_ROLE_ABILITIES.student);
    expect(ability.can('read', 'Timetable')).toBe(true);
    expect(ability.can('read', 'Subject')).toBe(true);
    expect(ability.can('create', 'Attendance')).toBe(false);
    expect(ability.can('update', 'Attendance')).toBe(false);
    expect(ability.can('manage', 'all')).toBe(false);
  });

  it('student attendance has condition placeholder for user.id', () => {
    const attendanceRule = DEFAULT_ROLE_ABILITIES.student.find((r) => r.subject === 'Attendance');
    expect(attendanceRule).toBeDefined();
    expect(attendanceRule?.conditions).toEqual({ studentId: '${user.id}' });
  });

  it('parent can read institute, academic structure, timetable, attendance, and students but not create/update', () => {
    const ability = createMongoAbility<AppAbility>(DEFAULT_ROLE_ABILITIES.parent);
    expect(ability.can('read', 'Institute')).toBe(true);
    expect(ability.can('read', 'AcademicYear')).toBe(true);
    expect(ability.can('read', 'Standard')).toBe(true);
    expect(ability.can('read', 'Section')).toBe(true);
    expect(ability.can('read', 'Subject')).toBe(true);
    expect(ability.can('read', 'Timetable')).toBe(true);
    expect(ability.can('read', 'Attendance')).toBe(true);
    expect(ability.can('read', 'Student')).toBe(true);
    expect(ability.can('create', 'Student')).toBe(false);
    expect(ability.can('update', 'Attendance')).toBe(false);
  });
});
