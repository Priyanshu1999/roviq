/**
 * Variable substitution for CASL conditions (ROV-166).
 *
 * Replaces $user.* placeholders in CASL conditions with actual user values.
 * Called during AbilityFactory.createForUser() when building the ability.
 *
 * By the time caslToSqlWhere() runs, all values are concrete — @ucast/sql
 * receives real UUIDs and arrays, not placeholder strings.
 */

export interface UserContext {
  userId: string;
  tenantId?: string;
  /** Section IDs the user is assigned to (class_teacher, subject_teacher) */
  assignedSections?: string[];
  /** Subject IDs the user teaches (subject_teacher) */
  assignedSubjects?: string[];
  /** Department IDs the user belongs to (department heads) */
  assignedDepartments?: string[];
}

/**
 * Substitute $user.* placeholders in CASL conditions with actual values.
 *
 * @example
 * substituteUserVars(
 *   { sectionId: { $in: '$user.assignedSections' } },
 *   { userId: 'abc', assignedSections: ['sec-1', 'sec-2'] },
 * )
 * // → { sectionId: { $in: ['sec-1', 'sec-2'] } }
 */
export function substituteUserVars<T extends Record<string, unknown>>(
  conditions: T,
  context: UserContext,
): T {
  return JSON.parse(JSON.stringify(conditions), (_key, value) => {
    if (typeof value !== 'string') return value;

    switch (value) {
      case '$user.sub':
      case '${user.id}':
        return context.userId;
      case '$user.tenantId':
      case '${user.tenantId}':
        return context.tenantId ?? '';
      case '$user.assignedSections':
        return context.assignedSections ?? [];
      case '$user.assignedSubjects':
        return context.assignedSubjects ?? [];
      case '$user.assignedDepartments':
        return context.assignedDepartments ?? [];
      default:
        return value;
    }
  });
}
