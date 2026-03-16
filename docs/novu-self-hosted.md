# Novu Self-Hosted (Local Dev)

Roviq supports both **Novu Cloud** and a **local self-hosted Novu instance**. The `NOVU_MODE` env var controls which one the application connects to.

## Quick Start

1. Start core infrastructure: `tilt up`
2. In Tilt UI (`http://localhost:10350`), start all resources in the **novu** group
3. Wait for `novu-api` to become healthy
4. Open the Novu Dashboard at `http://localhost:4000` and create an account (first time only)
5. Copy the Development environment API key from the dashboard (Settings → API Keys)
6. Set `NOVU_SECRET_KEY=<your-local-api-key>` in `.env`
7. Start the notification-service: `pnpm run dev:notifications`
8. Run `novu-sync-bridge` from Tilt UI to sync workflows (one-time per volume lifecycle)

> **Note:** The `NOVU_SECRET_KEY` in `.env` must match the local Novu's Development API key.
> When switching back to cloud mode, restore the original cloud key.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NOVU_MODE` | `local` | `local` for self-hosted, `cloud` for Novu Cloud |
| `NOVU_API_URL` | `http://localhost:3340` | Local Novu API URL (used when `NOVU_MODE=local`) |
| `NOVU_WS_URL` | `http://localhost:3342` | Local Novu WebSocket URL |
| `NOVU_SECRET_KEY` | — | Novu API secret key (shared between local instance and SDK) |
| `NOVU_JWT_SECRET` | `novu-local-jwt-...` | JWT secret for local Novu instance |
| `NOVU_STORE_ENCRYPTION_KEY` | `novulocal...` | 32-char encryption key for local Novu |
| `NEXT_PUBLIC_NOVU_BACKEND_URL` | (empty) | Frontend Inbox API URL (empty = Novu Cloud) |
| `NEXT_PUBLIC_NOVU_SOCKET_URL` | (empty) | Frontend Inbox WebSocket URL (empty = Novu Cloud) |

### Switching Modes

**Local mode** (default for dev):
```env
NOVU_MODE=local
NEXT_PUBLIC_NOVU_BACKEND_URL=http://localhost:3340
NEXT_PUBLIC_NOVU_SOCKET_URL=http://localhost:3342
```

**Cloud mode** (production):
```env
NOVU_MODE=cloud
NEXT_PUBLIC_NOVU_BACKEND_URL=
NEXT_PUBLIC_NOVU_SOCKET_URL=
```

When `NOVU_MODE=cloud`, the `@novu/api` SDK defaults to `https://api.novu.co` and the `@novu/nextjs` Inbox defaults to Novu Cloud endpoints. No local services are needed.

## Port Mapping

| Service | Port | URL |
|---------|------|-----|
| Novu API | 3340 | `http://localhost:3340` |
| Novu WebSocket | 3342 | `http://localhost:3342` |
| Novu Dashboard | 4000 | `http://localhost:4000` |
| MongoDB | 27017 | `mongodb://localhost:27017` |

Ports are remapped to avoid conflicts with api-gateway (3000), notification-service (3002), and admin-portal (4200).

## Architecture

```
                         NOVU_MODE=local
                              │
    ┌─────────────────────────┼─────────────────────────────┐
    │                         ▼                             │
    │  notification-service ─────► Novu API (:3340)         │
    │  (triggers, subscribers)     ▲                        │
    │                              │                        │
    │  api-gateway ────────────────┘  (device tokens)       │
    │                                                       │
    │  Frontend Inbox ───────────► Novu WS (:3342)          │
    │  (@novu/nextjs)              Novu API (:3340)         │
    │                                                       │
    │  Novu Dashboard (:4400) ─── visual admin UI           │
    │                                                       │
    │  Shared infra: MongoDB (:27017), Redis (:6379)        │
    └───────────────────────────────────────────────────────┘
```

## Bridge Sync

The notification-service exposes a Novu Framework bridge endpoint at `/api/novu` (port 3002). This is where workflow definitions live. The local Novu instance needs to know about this bridge to execute workflows.

**Sync via Tilt** (recommended): Run the `novu-sync-bridge` resource in Tilt UI. This calls `npx novu sync` to register the bridge URL with the local Novu instance.

**Sync manually**:
```bash
# Use your host IP (not host.docker.internal — unreliable on WSL2)
HOST_IP=$(ip addr show eth0 | grep "inet " | awk '{print $2}' | cut -d/ -f1)

npx novu@latest sync \
  --bridge-url "http://${HOST_IP}:3002/api/novu" \
  --secret-key "$NOVU_SECRET_KEY" \
  --api-url http://localhost:3340
```

The bridge URL is stored in MongoDB, so you only need to sync once per `docker volume` lifecycle (i.e., after `docker volume rm` or fresh setup).

## Troubleshooting

### Novu API won't start
- Ensure MongoDB and Redis are healthy in Tilt UI
- Check logs: `docker compose -f docker/compose.novu.yaml logs novu-api`

### Bridge sync fails
- Ensure notification-service is running on port 3002
- On WSL2, `host.docker.internal` may not resolve correctly. The Tilt sync resource and manual command above use `eth0` IP instead

### Inbox shows "connection error" in browser
- Set `NEXT_PUBLIC_NOVU_BACKEND_URL=http://localhost:3340` and `NEXT_PUBLIC_NOVU_SOCKET_URL=http://localhost:3342` in `.env`
- Restart the frontend app (Next.js needs restart for env changes)

### Workflows not appearing in Dashboard
- Run `novu-sync-bridge` again from Tilt UI
- Verify notification-service is running and `/api/novu` returns a response

### MongoDB for other services
MongoDB is shared infrastructure in `compose.infra.yaml`. Novu uses database `novu`. Other services can create their own databases (e.g., `mongodb://mongodb:27017/my-service`).
