// CI guard — run `pnpm codegen` and fail if any generated file changed.
// Catches stale TypedDocumentNode bundles and stale committed schema/types.
//
// Schema source (configured in `codegen.ts`):
//   - CI=1 → reads committed `schema.graphql` (offline)
//   - dev  → fetches from http://localhost:3005/api/graphql (live api-gateway)
// Without either, codegen fails with a network error. We detect that case
// up-front so the message is actionable instead of "ECONNREFUSED 3005".

import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const isCi = process.env.CI === 'true' || process.env.CI === '1';

if (!isCi) {
  // Probe the live api-gateway with a 1.5s timeout. If it doesn't answer,
  // codegen will hit ECONNREFUSED and emit a stack trace — pre-empt with a
  // clearer error so the developer knows what to do.
  let liveSchemaReachable = false;
  try {
    execFileSync(
      'curl',
      [
        '-sS',
        '--max-time',
        '1.5',
        '-X',
        'POST',
        '-H',
        'content-type: application/json',
        '-d',
        '{"query":"{__typename}"}',
        'http://localhost:3005/api/graphql',
      ],
      { stdio: 'pipe' },
    );
    liveSchemaReachable = true;
  } catch {
    liveSchemaReachable = false;
  }
  if (!liveSchemaReachable) {
    process.stderr.write(
      'check:codegen-drift — api-gateway is not reachable at http://localhost:3005/api/graphql.\n' +
        '\n' +
        'Codegen needs a schema source. Pick one:\n' +
        '  • Local dev — `tilt trigger api-gateway` and wait for it to be ready, then re-run\n' +
        '  • CI / offline — set CI=1 to read the committed `libs/frontend/graphql/src/generated/schema.graphql`:\n' +
        '      CI=1 pnpm check:codegen-drift\n' +
        '\n' +
        'Skipping check (gate runs cleanly in the CI lint job where CI=true is set automatically).\n',
    );
    process.exit(0);
  }
}

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
