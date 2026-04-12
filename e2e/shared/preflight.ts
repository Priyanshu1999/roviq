/**
 * Preflight — ensures the Docker E2E stack is running before tests start.
 *
 * - If API is already healthy: skips Docker entirely (fast iteration).
 *   Code changes are picked up automatically via volume mounts + nx serve.
 * - If API is not reachable: runs `pnpm e2e:up` (builds images + starts stack).
 *
 * For dependency or compose config changes, run `pnpm e2e:up` manually first.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const API_URL = process.env.API_URL || 'http://localhost:3004/api/graphql';
const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

async function isApiReady(): Promise<boolean> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: AbortSignal.timeout(1_000),
    });
    const json = (await res.json()) as { data?: { __typename: string } };
    return json.data?.__typename === 'Query';
  } catch {
    return false;
  }
}

export async function requireBackend(): Promise<void> {
  if (await isApiReady()) {
    console.log(`✓ API gateway already running at ${API_URL}`);
    return;
  }

  console.log('API not reachable — starting Docker E2E stack (pnpm e2e:up)...');
  const result = spawnSync('pnpm', ['e2e:up'], {
    cwd: WORKSPACE_ROOT,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error('\n\x1b[31m✗ pnpm e2e:up failed\x1b[0m\n');
    process.exit(1);
  }

  if (!(await isApiReady())) {
    console.error(`\n\x1b[31m✗ API gateway not reachable at ${API_URL} after e2e:up\x1b[0m\n`);
    process.exit(1);
  }

  console.log(`✓ API gateway ready at ${API_URL}`);
}

export default requireBackend;
