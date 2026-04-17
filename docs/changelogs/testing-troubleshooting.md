# Testing Troubleshooting Changelog

Append-only log of testing-infrastructure issues (slow pre-push, Docker rebuilds, flaky suites, cache misses, etc.) and their fixes.

**Rules:**
- Append only. Never edit or delete existing entries — once landed, they stay.
- Newest entry at the bottom.
- Each entry: date, status (`diagnosed` → `fixed`), scope, root cause, fix, references.
- When a `diagnosed` entry gets fixed, append a new `fixed` entry that references the diagnosis date — do not modify the original.

---

## 2026-04-16 — `diagnosed` — husky pre-push takes ~5 minutes

**Scope:** `.husky/pre-push`, `pnpm test:int`, `pnpm test:e2e:api`, `pnpm test:e2e:ui`.

**Root cause:** The hook runs four suites sequentially without any affected-based skipping and without going through Nx targets, so nothing ever hits Nx cache — every push pays full cost even when the diff is unrelated.

**Planned fix:** Replace `.husky/pre-push` with a script that (a) resolves a base SHA from pre-push stdin (fallback `origin/main`), (b) uses `nx show projects --affected` to decide which suites to run, (c) invokes each suite through Nx targets so unchanged inputs hit the cache. Escape hatch: `SKIP_PREPUSH=1 git push`.

**Notes:** E2E Nx projects (`api-gateway-e2e`, `web-{admin,reseller,institute}-e2e`) already carry `implicitDependencies` on `api-gateway`/`web`, so `nx affected` wiring is trivial. Integration tests do not yet have an Nx target and need one to be cacheable.

---

## 2026-04-16 — `diagnosed` — `pnpm e2e:up` rebuilds backend image on unrelated file changes

**Scope:** [docker/Dockerfile.backend:48](../../docker/Dockerfile.backend#L48), [.dockerignore](../../.dockerignore).

**Root cause:** The `dev` stage does `COPY --chown=node:node . .` as a single layer. Any change anywhere in the build context (including `apps/web/**`, `docs/**`, `e2e/**`) invalidates the layer, forcing a rebuild of every downstream service that uses `target: dev` (`api-gateway`, `notification-service`, `migrate-and-seed`, `vitest-e2e`, `rls-tests`). The copied files for `apps/api-gateway/src`, `libs`, `ee`, `dist`, and `scripts` are immediately shadowed at runtime by the volume mounts declared in `compose.e2e.yaml`, so the COPY is doing work that gets thrown away on container start.

**Planned fix:** Split the COPY into targeted directories (`apps/api-gateway`, `apps/notification-service`, `libs`, `ee`, `scripts`, `docker`, plus root configs) and add `apps/web`, `e2e`, `docs`, `.github`, `.husky` to `.dockerignore` so they never enter the backend build context.

---

## 2026-04-16 — `diagnosed` — Next.js rebuilds on every E2E UI run

**Scope:** [package.json](../../package.json) `dev:web:e2e` script, [e2e/playwright.config.ts:117](../../e2e/playwright.config.ts#L117).

**Root cause:** `dev:web:e2e` runs `rm -rf .next && next build` unconditionally, wiping Next's build cache before every Playwright run so Turbopack/webpack recompiles from scratch. Playwright's `webServer.reuseExistingServer: false` additionally forces a web-server restart every run, preventing reuse of an already-warm server on port 4201.

**Planned fix:** Drop `rm -rf .next` from `dev:web:e2e` (Next's build is content-hashed; unchanged `apps/web` is near-instant). Set `reuseExistingServer: !process.env.CI` so local reruns reuse a running server.

---

## 2026-04-17 — `fixed` — e2e api-gateway restart loop silently wipes host `dist/` via bind mount

**Scope:** [docker/compose.e2e.yaml](../../docker/compose.e2e.yaml) `api-gateway` + `notification-service`, host `pnpm run dev:gateway` / `tilt trigger api-gateway`.

**Root cause:** The e2e `api-gateway` service had `restart: unless-stopped` and bind-mounts `../dist:/app/dist`. When the image's `node_modules` went stale (new npm dep in `package.json` not mirrored into the pre-built image), the container crashed at build (`Cannot find module 'date-fns-tz'` on 2026-04-17), restarted, crashed again — 636 times. Each restart, `@nx/js:tsc`'s `compileTypeScriptWatcher` (see [@nx/workspace/src/utilities/typescript/compilation.js](../../node_modules/.pnpm/@nx+workspace@22.6.5_@swc-node+register@1.11.1_@emnapi+core@1.9.2_@emnapi+runtime@1.9.2_88211a056b9f8bab847602a5649bf277/node_modules/@nx/workspace/src/utilities/typescript/compilation.js)) calls `rmSync("/app/dist/apps/api-gateway", { recursive, force })` at startup; through the bind mount that deleted the host's `dist/apps/api-gateway/`. The host's `@nx/js:node` then forked against a missing `main.js` and crashed with "Could not find …/main.js. Make sure your build succeeded." Reproduced 8–60 s after each host `dev:gateway` start.

**Diagnosis difficulty:** Host-side JS spies (`NODE_OPTIONS=--require` hooking `fs.rmSync`/`fs.unlink`/`fs.rename`) and `strace -f` on the pnpm process tree **never saw the deletion** because it happened inside a container (separate PID namespace). System-wide `sudo bpftrace` on `sys_enter_unlinkat`/`sys_enter_rmdir` surfaced the culprit: `comm=MainThread path=/app/dist/apps/api-gateway`, a container-side path.

**Fix:** In [docker/compose.e2e.yaml](../../docker/compose.e2e.yaml), change `restart: unless-stopped` → `restart: on-failure:3` for `api-gateway` and add `restart: on-failure:3` to `notification-service`. Caps a bad restart storm at 3 attempts instead of infinite. The `../dist:/app/dist` bind mount is kept (e2e reuses host's build for fast startup); the restart cap is the guardrail. General diagnosis + recovery flow documented at [docs/troubleshooting.md](../troubleshooting.md).

**Escape hatch for recurrence:** `docker stop roviq-e2e-api-gateway-1 && pnpm e2e:down && pnpm e2e:up`. Never revert the restart policy back to `unless-stopped` — if a container needs to keep retrying, fix its image first.

---

## 2026-04-17 — `fixed` — e2e stack switched to named volumes for `dist/` + nx cache

**Scope:** [docker/compose.e2e.yaml](../../docker/compose.e2e.yaml) `api-gateway` + `migrate-and-seed`, [package.json](../../package.json) `e2e:down`/`e2e:nuke` scripts.

**Context:** Supersedes the earlier fix on 2026-04-17 that kept `../dist:/app/dist` and relied on `restart: on-failure:3` as the sole guardrail. Even with the restart cap, (a) the one-time `rmSync` at container boot still wiped the host's `dist/apps/api-gateway/`, killing any concurrent host `pnpm run dev:gateway`, and (b) the container's `nx serve` and host's `nx serve` both wrote to the same `dist/` directory when run in parallel, racing over partial emits. That pattern — sharing host build output with a container — is non-standard for Node.js dev stacks.

**Root cause of the non-standard pattern:** `../dist:/app/dist` was mounted to "reuse host's build output for fast e2e startup." It saves ~60–90s on first boot but produces hard-to-diagnose corruption whenever host + container are both active.

**Fix:** Follow the industry-standard isolation pattern:

- `api-gateway` and `migrate-and-seed` now mount `e2e_dist:/app/dist` (named volume, shared between the two services, isolated from host).
- `api-gateway` also mounts `e2e_nx_cache:/app/.nx/cache` (named volume) so the container's nx cache persists across `e2e:down` + `e2e:up` cycles. Cold starts after stop/start restore cached outputs in seconds instead of paying a full ~90s rebuild.
- `pnpm e2e:down` no longer passes `-v` — it stops containers but preserves both named volumes. New `pnpm e2e:nuke` script is the explicit opt-in for a clean slate (passes `-v`).
- `restart: on-failure:3` kept — still valuable for transient-failure self-healing (Postgres/Temporal slow start) and for a clear failure signal on hard bugs.

**Verification:** Post-change, `docker inspect roviq-e2e-api-gateway-1` shows `policy=on-failure:3`, `Mounts` uses `volume` type for `/app/dist` and `/app/.nx/cache`, and host `/home/priyanshu/roviq/dist/apps/api-gateway/src/main.js` survived a full `pnpm e2e:nuke && pnpm e2e:up` cycle untouched.

**Do NOT:**

- Revert `e2e_dist:/app/dist` back to `../dist:/app/dist` — this is the exact regression we just eliminated.
- Add `-v` back to `e2e:down` — makes every teardown pay full cold-rebuild cost.
- Revert `restart: on-failure:3` to `unless-stopped` — removes clear failure signal (see previous entry).

---
