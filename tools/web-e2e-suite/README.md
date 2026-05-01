# web-e2e-suite

Tools-only Nx project owning the `e2e` target that runs Playwright once for
every portal + cross-portal. The per-portal `web-{admin,institute,reseller}-e2e`
projects keep their existing uncached `e2e` targets for direct invocation;
they are NOT in `pnpm ci:check` because invoking three of them runs the whole
Playwright suite three times (Playwright project filtering happens at the
config level, not by cwd).

Pre-requisite: e2e Docker stack up and seeded. `pnpm ci:check` and
`pnpm test:e2e:ui` handle this; for standalone use:

```sh
pnpm e2e:up && pnpm e2e:clean && pnpm nx run web-e2e-suite:e2e
```

Cache hash is driven by `e2eFrontend` (see `nx.json`).
