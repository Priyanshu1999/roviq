/**
 * Novu test helpers — used by `notifications.api-e2e.spec.ts`.
 *
 * Credential resolution (first hit wins):
 *   1. Environment: `NOVU_API_URL`, `NOVU_SECRET_KEY`, `NOVU_APPLICATION_IDENTIFIER`.
 *      If the URL points at the in-network hostname (`novu-api:3000`), it is
 *      rewritten to the host-published URL below so Vitest running on the host
 *      can still reach it.
 *   2. The shared docker volume `roviq-e2e_novu_creds` — populated by the
 *      `novu-bootstrap` service on first boot. We read it via
 *      `docker run --rm -v ... alpine cat`, parse the `export KEY="VAL"` lines,
 *      and substitute the in-network hostname with `http://localhost:3443`
 *      (see compose.e2e.yaml — `novu-api` now publishes 3000 → host 3443).
 *
 * If neither source produces a full credential set, `getNovuCreds()` throws;
 * the spec catches and converts to `describe.skip`.
 */
import { execFileSync } from 'node:child_process';

export interface NovuCreds {
  apiUrl: string; // base URL, no /v1 suffix
  apiKey: string;
  appId: string;
}

const DOCKER_VOLUME = 'roviq-e2e_novu_creds';
const HOST_API_URL = 'http://localhost:3443';

function rewriteInternalHost(url: string | undefined): string | undefined {
  if (!url) return url;
  // The novu-bootstrap writes `http://novu-api:3000` — that hostname only
  // resolves inside the compose network. Rewrite for host-side callers.
  return url.replace(/^https?:\/\/novu-api:3000/, HOST_API_URL);
}

function readFromVolume(): Partial<NovuCreds> {
  try {
    const out = execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '-v',
        `${DOCKER_VOLUME}:/shared`,
        'alpine:3.21',
        'cat',
        '/shared/novu-creds.env',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
    );
    const env: Record<string, string> = {};
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m) env[m[1]] = m[2];
    }
    return {
      apiUrl: rewriteInternalHost(env.NOVU_API_URL),
      apiKey: env.NOVU_SECRET_KEY,
      appId: env.NOVU_APPLICATION_IDENTIFIER,
    };
  } catch {
    return {};
  }
}

let cached: NovuCreds | undefined;

export function getNovuCreds(): NovuCreds {
  if (cached) return cached;

  const fromEnv: Partial<NovuCreds> = {
    apiUrl: rewriteInternalHost(process.env.NOVU_API_URL),
    apiKey: process.env.NOVU_SECRET_KEY,
    appId: process.env.NOVU_APPLICATION_IDENTIFIER,
  };

  let creds: Partial<NovuCreds> = fromEnv;
  if (!creds.apiUrl || !creds.apiKey || !creds.appId) {
    const fromVol = readFromVolume();
    creds = {
      apiUrl: creds.apiUrl || fromVol.apiUrl,
      apiKey: creds.apiKey || fromVol.apiKey,
      appId: creds.appId || fromVol.appId,
    };
  }

  if (!creds.apiUrl || !creds.apiKey || !creds.appId) {
    throw new Error(
      'Novu credentials unavailable. Expected NOVU_API_URL / NOVU_SECRET_KEY / ' +
        `NOVU_APPLICATION_IDENTIFIER in env, or the docker volume "${DOCKER_VOLUME}" to ` +
        'contain /shared/novu-creds.env. Run `pnpm e2e:up` to start the stack.',
    );
  }

  cached = creds as NovuCreds;
  return cached;
}

async function novuFetch(
  path: string,
  init?: { method?: string; json?: unknown; headers?: Record<string, string> },
): Promise<Response> {
  const { apiUrl, apiKey } = getNovuCreds();
  const headers: Record<string, string> = {
    Authorization: `ApiKey ${apiKey}`,
    ...(init?.headers ?? {}),
  };
  let body: BodyInit | undefined;
  if (init?.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  return fetch(`${apiUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body,
  });
}

export async function novuHealth(): Promise<unknown> {
  const { apiUrl } = getNovuCreds();
  const res = await fetch(`${apiUrl}/v1/health-check`);
  if (!res.ok) throw new Error(`Novu health-check failed: ${res.status}`);
  return (await res.json()) as unknown;
}

/**
 * Synchronous TCP reachability probe for the Novu API. Returns `null` when
 * the host:port accepts a connection within `timeoutMs`, or a string
 * describing why it couldn't be reached. Used at module-load time by
 * `notifications.api-e2e.spec.ts` so the whole suite can skip via
 * `describe.skip` when Novu is down — otherwise the login-notification
 * test wastes its full 30s poll budget.
 *
 * TCP-probe (not HTTP) because the spec's collection phase runs
 * synchronously (vitest's CJS target forbids top-level `await`), but we
 * still need to decide at that moment whether the suite should collect
 * runnable tests or be skipped.
 */
export function probeNovuReachableSync(timeoutMs = 3_000): string | null {
  let apiUrl: string;
  try {
    apiUrl = getNovuCreds().apiUrl;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  let host: string;
  let port: number;
  try {
    const parsed = new URL(apiUrl);
    host = parsed.hostname;
    port = Number(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80);
  } catch {
    return `Novu apiUrl could not be parsed: ${apiUrl}`;
  }
  // Node's `net.createConnection` is async-only. Shell out to a tiny bash
  // TCP probe via `/dev/tcp` (dash-safe: invoked explicitly through
  // `bash -c`) — fast, synchronous, no extra deps.
  try {
    execFileSync('bash', ['-c', `exec 3<>/dev/tcp/${host}/${port} && exec 3<&- 3>&-`], {
      stdio: 'ignore',
      timeout: timeoutMs,
    });
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Novu not reachable at ${host}:${port} (${msg.split('\n')[0]})`;
  }
}

export async function ensureNovuSubscriber(
  subscriberId: string,
  extra?: { firstName?: string; lastName?: string; email?: string },
): Promise<void> {
  const res = await novuFetch('/v1/subscribers', {
    method: 'POST',
    json: { subscriberId, ...extra },
  });
  // Mirrors Hurl 02 Step 3: accept any status < 500 (already-exists etc.)
  if (res.status >= 500) {
    throw new Error(`ensureNovuSubscriber(${subscriberId}) failed: ${res.status}`);
  }
}

export async function deleteNovuSubscriber(subscriberId: string): Promise<void> {
  const res = await novuFetch(`/v1/subscribers/${encodeURIComponent(subscriberId)}`, {
    method: 'DELETE',
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`deleteNovuSubscriber(${subscriberId}) failed: ${res.status}`);
  }
}

export async function listNovuNotifications(subscriberId: string): Promise<{ data: unknown[] }> {
  const res = await novuFetch(
    `/v1/notifications?subscriberIds=${encodeURIComponent(subscriberId)}`,
  );
  if (!res.ok) {
    throw new Error(`listNovuNotifications(${subscriberId}) failed: ${res.status}`);
  }
  return (await res.json()) as { data: unknown[] };
}

export async function waitForNotification(subscriberId: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  const intervalMs = 3_000;
  let lastCount = 0;
  while (Date.now() - start < timeoutMs) {
    try {
      const page = await listNovuNotifications(subscriberId);
      lastCount = Array.isArray(page.data) ? page.data.length : 0;
      if (lastCount >= 1) return;
    } catch {
      // transient — retry until timeout
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `waitForNotification(${subscriberId}) timed out after ${timeoutMs}ms ` +
      `(last count: ${lastCount})`,
  );
}
