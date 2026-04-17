# Troubleshooting

Known footguns in the dev + infra setup. One entry per symptom. Keep entries tight — each should get you unstuck in under a minute.

---

## `pnpm run dev:gateway` / `tilt trigger api-gateway` crashes with `Could not find …/main.js`

**Symptom.** Log sequence looks like:

```text
Application is running on: http://localhost:3005/api
…
File change detected. Starting incremental compilation…
Found 0 errors. Watching for file changes.
Error: Could not find /home/…/dist/apps/api-gateway/src/main.js. Make sure your build succeeded.
```

Happens 8–60s after startup even with no code edits. Host-side `fs.rmSync` spies (`NODE_OPTIONS=--require`) and `strace -f` on the pnpm tree show nothing relevant — the deletion looks like it came from nowhere.

**Root cause.** A stale e2e Docker container (`roviq-e2e-api-gateway-1`) is stuck in a restart loop, and [docker/compose.e2e.yaml](../docker/compose.e2e.yaml) bind-mounts `../dist:/app/dist`. On every restart the container's `@nx/js:tsc` watcher does `rmSync("/app/dist/apps/api-gateway", { recursive, force })`. Through the bind mount that deletes the **host's** `dist/apps/api-gateway/` directory — including the `main.js` your local dev server just emitted. The host's `@nx/js:node` then tries to fork, `fileExists(main.js)` returns false, and throws.

You can't see the deletion from host processes because it happens inside a container with a different PID namespace. System-wide tracing catches it:

```bash
sudo bpftrace -e '
tracepoint:syscalls:sys_enter_unlinkat {
  printf("%s UNLINKAT pid=%d comm=%s path=%s\n",
    strftime("%H:%M:%S.%f", nsecs), pid, comm, str(args->pathname));
}'
```

Typical container failure reasons:

- A new npm dep was added, but the e2e image wasn't rebuilt and its `node_modules` is stale (missing module error).
- `Dockerfile.backend` or its dependencies changed without `--build` on the compose `up`.

**Diagnose.**

```bash
docker ps -a | grep -i restart     # containers in a restart loop
docker inspect roviq-e2e-api-gateway-1 --format '{{.RestartCount}} {{.State.Status}}'
docker logs --tail 40 roviq-e2e-api-gateway-1
```

If the log shows `Cannot find module '<something>'` or a TypeScript compile error, the image needs to be rebuilt against current `package.json` / source.

**Fix.**

```bash
docker stop roviq-e2e-api-gateway-1    # unblock the host dev server immediately
pnpm e2e:down                          # tear down the whole e2e stack
pnpm e2e:up                            # rebuilds the image against current deps
```

Then restart your local dev: `tilt trigger api-gateway` (or let Tilt auto-recover).

**Prevention in place.** [docker/compose.e2e.yaml](../docker/compose.e2e.yaml) follows the industry-standard pattern for Docker dev stacks: **source is bind-mounted, build output and nx cache are isolated via named volumes**.

- `api-gateway` and `migrate-and-seed` mount `e2e_dist:/app/dist` (named volume) — the container's dist is completely separate from the host's. Host `pnpm run dev:gateway` and the e2e stack can run simultaneously without racing over dist writes.
- `api-gateway` also mounts `e2e_nx_cache:/app/.nx/cache`. This persists across `e2e:down` + `e2e:up` cycles so cold starts restore nx cache hits in seconds instead of paying full ~90s rebuild.
- `api-gateway` and `notification-service` use `restart: on-failure:3` instead of `unless-stopped` — a failing container stops after 3 attempts instead of storm-restarting.
- Two separate teardowns:
  - `pnpm e2e:down` — stops containers, keeps volumes (fast next start).
  - `pnpm e2e:nuke` — stops containers AND wipes volumes (clean slate, pays full rebuild on next `e2e:up`).

**Do NOT** revert any of the above to the old pattern:

- Don't change `e2e_dist:/app/dist` back to `../dist:/app/dist` — the shared bind mount is what caused the original destruction.
- Don't change `restart: on-failure:3` back to `unless-stopped` — removes the guardrail against container-build failures.
- Don't add `-v` to `e2e:down` — makes every teardown pay full cold rebuild cost on next start.
