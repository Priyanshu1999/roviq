# integration-tests

Tools-only Nx project owning the `test:int` target. Wraps
`vitest run --project integration` (root `vitest.config.ts`) into a single
cacheable target so cross-cutting integration specs share one cache hash.

Always invoke directly — `nx affected` will not pick this up because the
project owns no source files. The target's input hash (`integrationSources`
in `nx.json`) decides cache hit vs miss.

```sh
pnpm nx run integration-tests:test:int   # or: pnpm test:int
```
