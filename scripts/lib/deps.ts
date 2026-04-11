/**
 * Shared dependency-update library.
 *
 * Queries `pnpm outdated`, enriches each package with its publish time from the
 * npm registry, and buckets updates by eligibility against a minimum release
 * age (24h for minor/patch, 7d for major). Used by deps-check / deps-update /
 * deps-upgrade.
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

export const MIN_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const MAJOR_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type DependencyType = 'dependencies' | 'devDependencies' | 'optionalDependencies';

export interface OutdatedEntry {
  current: string;
  latest: string;
  wanted: string;
  dependencyType: DependencyType;
}

export interface NpmPackageMeta {
  time: Record<string, string>;
  repository?: { url?: string };
  homepage?: string;
}

export interface Bucket {
  pkg: string;
  from: string;
  to: string;
  ageMs: number;
  isMajor: boolean;
}

export interface UnknownBucket extends Omit<Bucket, 'ageMs'> {
  ageMs: null;
}

export interface EligibilityResult {
  eligible: Bucket[];
  tooNew: Bucket[];
  unknown: UnknownBucket[];
}

export function parseMajor(version: string): number | null {
  const match = version.match(/^\D*(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function isMajorBump(from: string, to: string): boolean {
  const fromMajor = parseMajor(from);
  const toMajor = parseMajor(to);
  if (fromMajor === null || toMajor === null) return false;
  return toMajor > fromMajor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Child-process helpers (shared by deps-update.ts and deps-upgrade.ts)
// ─────────────────────────────────────────────────────────────────────────────

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function run(cmd: string, args: string[], inherit = false): RunResult {
  const result = spawnSync(cmd, args, {
    encoding: 'utf-8',
    stdio: inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export function git(...args: string[]): string {
  const r = run('git', args);
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${r.status}): ${r.stderr.trim()}`);
  }
  return r.stdout.trim();
}

export function assertGitClean(): void {
  const status = git('status', '--porcelain');
  if (status.length > 0) {
    console.error(color(C.red, '✗ Git working tree is not clean. Commit or stash first.'));
    console.error(status);
    process.exit(1);
  }
}

/**
 * Print the current dirty state and a manual rollback hint. Used by the two
 * apply scripts when a step fails — we intentionally do NOT auto-rollback,
 * so any partial migration work stays on disk for the human to inspect.
 */
export function printPreserveNotice(preSha: string, reason: string): void {
  console.error(color(C.red, `\n✗ ${reason}`));
  const dirty = git('status', '--porcelain');
  if (dirty) {
    const lines = dirty.split('\n');
    console.error(color(C.yellow, '\nWorking tree has uncommitted changes (preserved):'));
    for (const line of lines.slice(0, 15)) console.error(`  ${line}`);
    if (lines.length > 15) {
      console.error(color(C.dim, `  ... (${lines.length - 15} more)`));
    }
  }
  console.error(color(C.yellow, `\nHEAD was at ${preSha.slice(0, 7)} before this run.`));
  console.error(color(C.yellow, 'To discard everything and rollback manually:'));
  console.error(color(C.cyan, `  git reset --hard ${preSha} && git clean -fd`));
}

// ─────────────────────────────────────────────────────────────────────────────
// npm registry
// ─────────────────────────────────────────────────────────────────────────────

// Memoised per-process so deps-upgrade.ts can look up repo URLs without a
// second round-trip per package (getEligibility already fetches each one).
const metaCache = new Map<string, Promise<NpmPackageMeta | null>>();

export function fetchPackageMeta(pkg: string): Promise<NpmPackageMeta | null> {
  const cached = metaCache.get(pkg);
  if (cached) return cached;
  const pending = (async (): Promise<NpmPackageMeta | null> => {
    try {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
      if (!res.ok) return null;
      return (await res.json()) as NpmPackageMeta;
    } catch {
      return null;
    }
  })();
  metaCache.set(pkg, pending);
  return pending;
}

export async function fetchPublishTime(pkg: string, version: string): Promise<Date | null> {
  const meta = await fetchPackageMeta(pkg);
  const isoTime = meta?.time?.[version];
  return isoTime ? new Date(isoTime) : null;
}

/**
 * Derive a best-effort https repo URL from an npm package's `repository.url`
 * field. Handles the common `git+https://…`, `git://…`, `.git` suffix shapes.
 */
export function normalizeRepoUrl(meta: NpmPackageMeta | null): string | null {
  const raw = meta?.repository?.url;
  if (!raw) return meta?.homepage ?? null;
  let url = raw.replace(/^git\+/, '').replace(/\.git$/, '');
  if (url.startsWith('git://')) url = `https://${url.slice(6)}`;
  if (url.startsWith('ssh://git@')) url = `https://${url.slice(10)}`;
  if (!/^https?:\/\//.test(url)) return meta?.homepage ?? null;
  return url;
}

// ─────────────────────────────────────────────────────────────────────────────
// pnpm outdated → eligibility
// ─────────────────────────────────────────────────────────────────────────────

export function getOutdated(): Record<string, OutdatedEntry> {
  // pnpm outdated exits 1 when packages are outdated — stdout still has the JSON.
  const result = run('pnpm', ['outdated', '--format', 'json']);
  const raw = result.stdout.trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, OutdatedEntry>;
  } catch (err) {
    throw new Error(`Failed to parse pnpm outdated output as JSON: ${(err as Error).message}`);
  }
}

/**
 * Query `pnpm outdated`, fetch each package's publish time from npm in
 * parallel, and bucket the results. `tooNew` packages are those below their
 * minimum release age (24h for non-major, 7d for major).
 */
export async function getEligibility(): Promise<EligibilityResult> {
  const outdated = getOutdated();
  const entries = Object.entries(outdated);
  if (entries.length === 0) {
    return { eligible: [], tooNew: [], unknown: [] };
  }

  const now = Date.now();
  const results = await Promise.all(
    entries.map(async ([pkg, info]) => ({
      pkg,
      info,
      publishedAt: await fetchPublishTime(pkg, info.latest),
    })),
  );

  const eligible: Bucket[] = [];
  const tooNew: Bucket[] = [];
  const unknown: UnknownBucket[] = [];

  for (const { pkg, info, publishedAt } of results) {
    const isMajor = isMajorBump(info.current, info.latest);
    const base = { pkg, from: info.current, to: info.latest, isMajor };
    if (!publishedAt) {
      unknown.push({ ...base, ageMs: null });
      continue;
    }
    const ageMs = now - publishedAt.getTime();
    const minAge = isMajor ? MAJOR_MIN_AGE_MS : MIN_AGE_MS;
    if (ageMs >= minAge) {
      eligible.push({ ...base, ageMs });
    } else {
      tooNew.push({ ...base, ageMs });
    }
  }

  const byName = (a: { pkg: string }, b: { pkg: string }) => a.pkg.localeCompare(b.pkg);
  eligible.sort(byName);
  tooNew.sort(byName);
  unknown.sort(byName);

  return { eligible, tooNew, unknown };
}

/**
 * Validate an `<pkg>@<version>` spec before handing it to a child process.
 * Rejects anything with shell metachars, paths, or out-of-spec characters.
 */
export function isValidSpec(spec: string): boolean {
  return /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*@[a-z0-9][a-z0-9.+\-^~<>=]*$/i.test(spec);
}

export function formatAge(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANSI colour helpers
// ─────────────────────────────────────────────────────────────────────────────

// ESC byte built at runtime to avoid biome's noControlCharactersInRegex rule.
const ESC = String.fromCharCode(27);
export const color = (c: string, s: string): string => `${ESC}[${c}m${s}${ESC}[0m`;
export const C = {
  reset: '0',
  bold: '1',
  dim: '2',
  red: '31',
  green: '32',
  yellow: '33',
  cyan: '36',
} as const;
