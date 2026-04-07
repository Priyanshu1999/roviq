/**
 * Group rule interpreter — wraps @ucast/sql with field→column mapping (ROV-163).
 *
 * Converts a JsonLogic group rule to a parameterized SQL WHERE clause.
 * Uses @ucast/sql (shared with CASL bridge in ROV-166) for SQL generation.
 *
 * Pipeline: JsonLogic → jsonLogicToUcast() → @ucast/sql interpret() → SQL string + params
 */
import { allInterpreters, createSqlInterpreter, pg } from '@ucast/sql';
import { type SQL, sql } from 'drizzle-orm';
import { jsonLogicToUcast } from './json-logic-to-ucast';

const interpret = createSqlInterpreter(allInterpreters);

/**
 * Variable name → PostgreSQL fully-qualified column path.
 * Maps the 18+ group rule dimensions to their actual DB columns.
 *
 * These are the dimensions from PRD Part 4 §1.2:
 * - user_profiles: gender, date_of_birth, religion, mother_tongue, nationality
 * - student_profiles: social_category, is_minority, is_bpl, is_cwsn,
 *   is_rte_admitted, academic_status, stream, admission_type
 * - student_academics: standard_id, section_id, house_id, route_id
 * - sections (via join): shift, medium
 */
const DIMENSION_TO_COLUMN: Record<string, string> = {
  // user_profiles
  gender: '"user_profiles"."gender"',
  date_of_birth: '"user_profiles"."date_of_birth"',
  religion: '"user_profiles"."religion"',
  mother_tongue: '"user_profiles"."mother_tongue"',
  nationality: '"user_profiles"."nationality"',
  // student_profiles
  social_category: '"student_profiles"."social_category"',
  is_minority: '"student_profiles"."is_minority"',
  is_bpl: '"student_profiles"."is_bpl"',
  is_cwsn: '"student_profiles"."is_cwsn"',
  is_rte_admitted: '"student_profiles"."is_rte_admitted"',
  academic_status: '"student_profiles"."academic_status"',
  stream: '"student_profiles"."stream"',
  admission_type: '"student_profiles"."admission_type"',
  // student_academics
  standard_id: '"student_academics"."standard_id"',
  section_id: '"student_academics"."section_id"',
  house_id: '"student_academics"."house_id"',
  route_id: '"student_academics"."route_id"',
  // sections (via join)
  shift: '"sections"."shift"',
  medium: '"sections"."medium_of_instruction"',
};

/** Type for a JsonLogic rule — the input format stored in group_rules.rule */
export type JsonLogicRule = Record<string, unknown>;

/**
 * Convert a JsonLogic group rule to a parameterized SQL WHERE clause.
 * Uses @ucast/sql (shared with CASL bridge in ROV-166) for SQL generation.
 *
 * @param rule - JsonLogic rule object from group_rules.rule
 * @returns { sqlString, params } or undefined if rule is empty/null
 *
 * @example
 * groupRuleToSql({ "==": [{ "var": "gender" }, "female"] })
 * // → { sqlString: '"user_profiles"."gender" = $1', params: ['female'] }
 */
export function groupRuleToSql(
  rule: JsonLogicRule | null | undefined,
): { sqlString: string; params: unknown[] } | undefined {
  if (!rule || Object.keys(rule).length === 0) return undefined;

  const ast = jsonLogicToUcast(rule);
  const [sqlString, params] = interpret(ast, {
    ...pg,
    // Override escapeField to use our dimension→column mapping.
    // The mapping values are already pre-escaped (e.g., '"user_profiles"."gender"')
    // so we return them directly instead of applying pg's default escaping.
    escapeField: (field: string) => DIMENSION_TO_COLUMN[field] ?? pg.escapeField(field),
    joinRelation: () => false,
  });

  return { sqlString, params };
}

/**
 * Convert a JsonLogic group rule to a Drizzle SQL object with proper
 * parameter binding. Use this in `.where()` or `tx.execute()`.
 *
 * This replaces @ucast/sql's `$1, $2...` positional placeholders with
 * Drizzle's parameter binding to prevent SQL injection.
 */
export function groupRuleToDrizzleSql(rule: JsonLogicRule): SQL | undefined {
  const result = groupRuleToSql(rule);
  if (!result) return undefined;

  // Split the SQL string by $N placeholders and interleave with Drizzle params
  const { sqlString, params } = result;
  const parts = sqlString.split(/\$(\d+)/);

  // Build a Drizzle sql template: alternating raw SQL chunks and bound params
  const chunks: SQL[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // Raw SQL text
      if (parts[i]) chunks.push(sql.raw(parts[i]));
    } else {
      // Parameter reference ($N → params[N-1])
      const paramIndex = Number.parseInt(parts[i], 10) - 1;
      chunks.push(sql`${params[paramIndex]}`);
    }
  }

  if (chunks.length === 0) return undefined;
  if (chunks.length === 1) return chunks[0];

  // Join all chunks into a single SQL expression
  return sql.join(chunks, sql``);
}
