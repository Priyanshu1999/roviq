// Browser-side helpers used by every observability fetch.
// `authFetch` attaches the platform-scope access token as a Bearer header
// so the server-side proxy routes can verify the caller is an admin.
// `errMessage` is the project-standard `unknown → string` formatter; it
// avoids the [NTESC] `as Error` escape hatch.

const PLATFORM_TOKEN_KEY = 'roviq-platform-access-token';

function getPlatformToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(PLATFORM_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getPlatformToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers, cache: 'no-store' });
}

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Service-name allowlist — restricts what we allow into a Prometheus /
 * Loki / Tempo selector. Names are user-controlled (URL state) so without
 * this, a crafted `?svc=foo"} | drop` triggers LogQL/TraceQL injection in
 * the consumers (see review M3). Also used by buildQueries.
 */
export function sanitizeServiceNames(names: readonly string[]): string[] {
  return names.filter((s) => /^[a-zA-Z0-9_.-]+$/.test(s));
}
