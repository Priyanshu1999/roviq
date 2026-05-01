// Static-source coverage check: every `@CheckAbility(action, subject)` used
// by a resolver is reachable by at least one default role's abilities.
//
// Catches the silent class of bug where a resolver guards a mutation with
// an (action, subject) pair that no role grants — the endpoint compiles,
// the decorator is typed (AppAction × AppSubject), but every authenticated
// user gets 403 Forbidden because nothing in `DEFAULT_ROLE_ABILITIES` adds
// up to the requested permission. CASL semantics:
//   - `manage` on a subject covers ANY action on that subject (including
//      custom verbs like `update_info`, `assign_teacher`).
//   - `manage` on `all` covers anything.
//   - Otherwise an exact (action, subject) match is required.
//
// We do this with a regex over source rather than booting CASL because
// the goal is catching the omission at the same review hop where the
// resolver was added — booting `AbilityFactory` requires Redis + DB.
//
// Conditions are intentionally ignored for the reachability check: a
// section-scoped condition like `{ sectionId: { $in: '$user.assignedSections' } }`
// still makes the (action, subject) pair "reachable" — the condition
// filters which rows the user sees at runtime, not whether the verb is
// allowed at all.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { type AbilityRule, DEFAULT_ROLE_ABILITIES } from '@roviq/common-types';
import { describe, expect, it } from 'vitest';

const API_GATEWAY_SRC = join(__dirname, '..');
const EE_API_GATEWAY_SRC = join(__dirname, '../../../../ee/apps/api-gateway/src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      out.push(...walk(full));
    } else if (
      entry.endsWith('.ts') &&
      !entry.endsWith('.spec.ts') &&
      !entry.endsWith('.integration.spec.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

function safeWalk(dir: string): string[] {
  try {
    statSync(dir);
    return walk(dir);
  } catch {
    return [];
  }
}

interface UsedPair {
  action: string;
  subject: string;
  file: string;
}

const CHECK_ABILITY_RE = /@CheckAbility\s*\(\s*['"]([a-z_]+)['"]\s*,\s*['"]([A-Z][A-Za-z]*)['"]/g;

function collectUsedPairs(): UsedPair[] {
  const out: UsedPair[] = [];
  for (const file of [...safeWalk(API_GATEWAY_SRC), ...safeWalk(EE_API_GATEWAY_SRC)]) {
    const content = readFileSync(file, 'utf8');
    CHECK_ABILITY_RE.lastIndex = 0;
    for (const match of content.matchAll(CHECK_ABILITY_RE)) {
      const action = match[1];
      const subject = match[2];
      if (action && subject) out.push({ action, subject, file });
    }
  }
  return out;
}

function ruleCoversAny(rule: AbilityRule): boolean {
  return rule.action === 'manage' && rule.subject === 'all';
}

function ruleCoversSubject(rule: AbilityRule, subject: string): boolean {
  if (rule.action !== 'manage') return false;
  return rule.subject === subject;
}

function ruleExactlyMatches(rule: AbilityRule, action: string, subject: string): boolean {
  return rule.action === action && rule.subject === subject;
}

function isReachableByRole(action: string, subject: string, abilities: AbilityRule[]): boolean {
  for (const rule of abilities) {
    if (ruleCoversAny(rule)) return true;
    if (ruleCoversSubject(rule, subject)) return true;
    if (ruleExactlyMatches(rule, action, subject)) return true;
  }
  return false;
}

function isGrantedRuleUsed(rule: AbilityRule, used: UsedPair[], usedKeys: Set<string>): boolean {
  // `manage:Subject` grants every action on Subject — counted as "used" if
  // any resolver gates anything on that subject.
  if (rule.action === 'manage' && typeof rule.subject === 'string') {
    return used.some((p) => p.subject === rule.subject);
  }
  return usedKeys.has(`${String(rule.action)}:${String(rule.subject)}`);
}

function collectUngrantedPairs(
  used: UsedPair[],
  usedKeys: Set<string>,
  allow: Set<string>,
): string[] {
  const out: string[] = [];
  for (const abilities of Object.values(DEFAULT_ROLE_ABILITIES)) {
    for (const rule of abilities) {
      if (typeof rule.action !== 'string' || typeof rule.subject !== 'string') continue;
      const key = `${rule.action}:${rule.subject}`;
      if (allow.has(key)) continue;
      if (!isGrantedRuleUsed(rule, used, usedKeys)) out.push(key);
    }
  }
  return out;
}

describe('CASL ability coverage', () => {
  it('every @CheckAbility(action, subject) is reachable by ≥ 1 default role', () => {
    const used = collectUsedPairs();
    expect(used.length).toBeGreaterThan(20); // sanity: ~280 across api-gateway + ee

    // Deduplicate by (action, subject); keep one example file per pair.
    const unique = new Map<string, UsedPair>();
    for (const p of used) {
      const key = `${p.action}:${p.subject}`;
      if (!unique.has(key)) unique.set(key, p);
    }

    const allRoleAbilities = Object.values(DEFAULT_ROLE_ABILITIES);
    const unreachable: string[] = [];

    for (const [key, pair] of unique) {
      const reachable = allRoleAbilities.some((abilities) =>
        isReachableByRole(pair.action, pair.subject, abilities),
      );
      if (!reachable) {
        unreachable.push(`${key}  (e.g. ${pair.file.split('/').slice(-3).join('/')})`);
      }
    }

    expect(
      unreachable,
      `(action, subject) pairs guarded by some resolver but no default role can reach:\n  ${unreachable.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every (action, subject) granted to a default role is used by ≥ 1 resolver', () => {
    const used = collectUsedPairs();
    const usedKeys = new Set(used.map((p) => `${p.action}:${p.subject}`));

    // Subjects that are intentionally granted but exercised through paths
    // other than `@CheckAbility` decorators (custom guards, scope filters,
    // resolver-internal CASL.can() calls). Listed here so the test
    // documents the gap rather than pretending it doesn't exist.
    const allowGrantedButUnused = new Set<string>([
      // Self-service: every authenticated user can read/update their own User
      // — enforced inline in the user/profile resolver via `{ userId: '$user.sub' }`,
      // not via @CheckAbility.
      'read:User',
      'update:User',
      // `manage:all` is the platform-admin shortcut — never gated by a
      // specific @CheckAbility because admin endpoints use scope guards.
      'manage:all',
      // Abilities pre-defined for roles whose resolvers haven't shipped yet.
      // Listed here so adding a NEW unused ability fails the test (forces a
      // decision: ship the resolver, or remove the role grant), while
      // documented future-feature placeholders pass through. Drop entries
      // from this list as resolvers land.
      'manage:Fee',
      'read:Timetable',
      'manage:Exam',
      'manage:ReportCard',
      'manage:Activity',
      'manage:LibraryTransaction',
      'manage:BusRoute',
      'manage:HostelRoom',
      'manage:CounselorNotes',
      'manage:HealthRecord',
      'read:HealthRecord',
      'manage:SportsTeam',
      'read:SystemConfig',
    ]);

    const ungranted: string[] = collectUngrantedPairs(used, usedKeys, allowGrantedButUnused);

    const unique = Array.from(new Set(ungranted));
    expect(
      unique,
      `(action, subject) pairs granted to some role but no resolver guards them with @CheckAbility:\n  ${unique.join('\n  ')}`,
    ).toEqual([]);
  });
});
