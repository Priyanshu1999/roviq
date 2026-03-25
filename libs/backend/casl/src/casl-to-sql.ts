/**
 * CASL-to-SQL bridge using @ucast/sql (ROV-166).
 *
 * Converts CASL ability rules for a given action+subject into a Drizzle SQL
 * WHERE clause. Uses @ucast/sql (by the CASL author) to interpret CASL's
 * internal MongoDB-style conditions into parameterized PostgreSQL SQL.
 *
 * Pipeline:
 *   CASL ability → rulesToAST() → @ucast/core Condition → @ucast/sql → SQL + params → Drizzle sql
 */
import { rulesToAST } from '@casl/ability/extra';
import type { AppAbility, AppAction, AppSubject } from '@roviq/common-types';
import { allInterpreters, createSqlInterpreter, pg } from '@ucast/sql';
import { type SQL, sql } from 'drizzle-orm';

const interpret = createSqlInterpreter(allInterpreters);

/**
 * Field name → PostgreSQL column name mapping.
 *
 * Maps camelCase CASL condition field names to snake_case PostgreSQL column names.
 * When CASL conditions reference "sectionId", @ucast/sql needs to produce "section_id".
 */
const FIELD_TO_COLUMN: Record<string, string> = {
  userId: 'user_id',
  tenantId: 'tenant_id',
  sectionId: 'section_id',
  standardId: 'standard_id',
  departmentId: 'department_id',
  studentId: 'student_id',
  membershipId: 'membership_id',
  academicYearId: 'academic_year_id',
};

/**
 * Convert CASL ability rules for a given action+subject into a Drizzle SQL WHERE clause.
 *
 * @param ability - The user's CASL ability (from AbilityFactory)
 * @param action - The action being checked (e.g., 'read', 'update')
 * @param subject - The subject being accessed (e.g., 'Student', 'Attendance')
 * @returns Drizzle SQL expression for .where(), or undefined if no restrictions (manage:all)
 *
 * @example
 * // Teacher with section restriction:
 * caslToSqlWhere(teacherAbility, 'read', 'Student')
 * // → sql`"section_id" IN ($1, $2)` with teacher's section UUIDs
 *
 * // Admin with manage:all:
 * caslToSqlWhere(adminAbility, 'read', 'Student')
 * // → undefined (no restriction)
 *
 * // Student with own-data restriction:
 * caslToSqlWhere(studentAbility, 'read', 'Student')
 * // → sql`"user_id" = $1` with student's user ID
 */
export function caslToSqlWhere(
  ability: AppAbility,
  action: AppAction,
  subject: AppSubject,
): SQL | undefined {
  // rulesToAST extracts the @ucast/core Condition from CASL's internal representation
  const ast = rulesToAST(ability, action, subject);

  // null = no matching rules = no access. Return sql`false` to block all rows.
  // undefined return = no restrictions (manage:all or unconditional rule)
  if (ast === null) return sql`false`;

  // If the AST is a trivial "true" (unconditional allow), return undefined = no filter
  if ('operator' in ast && ast.operator === 'and' && 'value' in ast) {
    const val = ast.value;
    if (Array.isArray(val) && val.length === 0) return undefined;
  }

  const [sqlString, params] = interpret(ast, {
    ...pg,
    escapeField: (field: string) => {
      const mapped = FIELD_TO_COLUMN[field] ?? field;
      return `"${mapped}"`;
    },
    joinRelation: () => false,
  });

  if (!sqlString || sqlString === '()') return undefined;

  // Build Drizzle SQL with proper parameter binding
  // Split $N placeholders and bind params via sql template
  const parts = sqlString.split(/\$(\d+)/);
  const chunks: SQL[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (parts[i]) chunks.push(sql.raw(parts[i]));
    } else {
      const paramIndex = Number.parseInt(parts[i], 10) - 1;
      chunks.push(sql`${params[paramIndex]}`);
    }
  }

  if (chunks.length === 0) return undefined;
  return chunks.length === 1 ? chunks[0] : sql.join(chunks, sql``);
}
