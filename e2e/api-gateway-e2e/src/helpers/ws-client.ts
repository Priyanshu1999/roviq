import { createClient } from 'graphql-ws';
import WebSocket from 'ws';

const WS_URL = process.env.WS_URL ?? 'ws://localhost:3000/api/graphql';
const API_URL = process.env.API_URL ?? 'http://localhost:3000/api/graphql';
// Strip `/graphql` (with or without trailing slash) to get the API base.
const API_BASE = API_URL.replace(/\/graphql\/?$/, '');

/**
 * Exchange a JWT access token for a single-use WebSocket ticket.
 *
 * The server rejects WebSocket `connection_init` payloads that use
 * `Authorization: Bearer ...`; it expects `connectionParams.ticket` — a
 * random UUID that the auth module stored in Redis under
 * `ws-ticket:<uuid>` for 30 seconds. The ticket is deleted on first use.
 *
 * Endpoint: `GET /api/auth/ws-ticket`, auth via `Authorization: Bearer <token>`.
 */
async function exchangeWsTicket(token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/ws-ticket`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to exchange ws-ticket: HTTP ${res.status} ${res.statusText} — ${body}`);
  }
  const { ticket } = (await res.json()) as { ticket: string };
  if (!ticket) throw new Error('ws-ticket response missing `ticket` field');
  return ticket;
}

/**
 * Subscribe to a GraphQL subscription and resolve with the first received event.
 * Automatically cleans up after receiving one event or on timeout.
 *
 * Handles the ws-ticket exchange transparently — callers pass an access token
 * and this helper fetches a single-use ticket before opening the WebSocket.
 */
export async function subscribeOnce<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  timeoutMs = 5000,
): Promise<T> {
  const ticket = await exchangeWsTicket(token);

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Subscription timeout')), timeoutMs);

    const client = createClient({
      url: WS_URL,
      webSocketImpl: WebSocket,
      connectionParams: { ticket },
      // The server deletes the ticket on first use — the client must not
      // attempt to silently reconnect with the same (now-invalid) ticket.
      retryAttempts: 0,
    });

    const unsubscribe = client.subscribe(
      { query, variables },
      {
        next: (message) => {
          clearTimeout(timer);
          unsubscribe();
          client.dispose();
          // graphql-ws delivers `{ data?, errors?, extensions? }`. If the
          // subscription resolver or any field resolver threw, `errors` is
          // set and `data` is null — we must surface that instead of
          // silently resolving to `undefined`.
          if (message.errors && message.errors.length > 0) {
            reject(new Error(`Subscription returned errors: ${JSON.stringify(message.errors)}`));
            return;
          }
          if (message.data === null || message.data === undefined) {
            reject(new Error(`Subscription returned empty data: ${JSON.stringify(message)}`));
            return;
          }
          resolve(message.data as T);
        },
        error: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        complete: () => {},
      },
    );
  });
}
