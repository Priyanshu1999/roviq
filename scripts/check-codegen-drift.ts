/**
 * CI guard — run `pnpm codegen` and fail if any generated file changed.
 * Catches stale TypedDocumentNode bundles and stale committed schema/types.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

process.stdout.write('check:codegen-drift — running pnpm codegen…\n');
const codegen = spawnSync('pnpm', ['codegen'], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (codegen.status !== 0) {
  process.stderr.write(`codegen exited with status ${codegen.status}\n`);
  process.exit(1);
}

// Only watch codegen outputs — apps/web source files are owned by humans,
// only their `.generated.ts` siblings (emitted by near-operation-file preset)
// belong to codegen. Use git pathspec magic ":(glob)" for recursive globs.
const checkPaths = [
  'libs/frontend/graphql/src/generated/schema.graphql',
  'libs/frontend/graphql/src/generated/graphql.ts',
  'e2e/api-gateway-e2e/src/__generated__/graphql.ts',
  ':(glob)apps/**/*.generated.ts',
];

const diff = execFileSync('git', ['diff', '--name-only', '--', ...checkPaths], {
  cwd: ROOT,
  encoding: 'utf8',
}).trim();

if (diff.length === 0) {
  process.stdout.write('check:codegen-drift — generated files up to date.\n');
  process.exit(0);
}
process.stderr.write(
  `check:codegen-drift — generated files are out of sync:\n\n${diff}\n\nRun \`pnpm codegen\` and commit.\n`,
);
process.exit(1);
