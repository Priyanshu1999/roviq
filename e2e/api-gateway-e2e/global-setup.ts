import { type ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');

const API_URL = process.env.API_URL || 'http://localhost:3000/api/graphql';
let serverProcess: ChildProcess | undefined;

async function isApiReady(): Promise<boolean> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    const json = (await res.json()) as { data?: { __typename: string } };
    return json.data?.__typename === 'Query';
  } catch {
    return false;
  }
}

async function waitForApi(timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isApiReady()) return;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`API not ready after ${timeoutMs}ms`);
}

export async function setup(): Promise<void> {
  if (await isApiReady()) {
    console.log('API already running, skipping server start');
    return;
  }

  console.log('Starting API gateway...');
  serverProcess = spawn('pnpm', ['run', 'dev:gateway'], {
    cwd: WORKSPACE_ROOT,
    stdio: 'pipe',
    detached: true,
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString();
    if (msg.includes('ERROR')) console.error(msg);
  });

  await waitForApi();
  console.log('API gateway ready');
}

export async function teardown(): Promise<void> {
  if (serverProcess?.pid) {
    // Kill the process group (detached)
    try {
      process.kill(-serverProcess.pid, 'SIGTERM');
    } catch {
      // already dead
    }
  }
}
