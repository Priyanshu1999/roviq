# Roviq Portal Testing

## Testing Instructions

1. **Test every feature deeply** — not shallow page-load checks. Open forms, submit data, verify results in DB, check error states.
2. **If a page says "no data"** (no standards, no plans, etc.), create the data first before moving on. Don't skip features because seed data is missing.
3. **If something fails**, check network requests and console logs. Before fixing, write a failing test so we catch regressions in CI, not at runtime. Then fix with a standard solution, not a workaround.
4. **Update checklist files continuously** — mark each granular feature as tested before moving to the next. These files are the source of truth for what works and what doesn't.
5. **Cross-portal workflows** (e.g. reseller creates institute -> admin approves -> institute admin logs in) require multiple browser instances/tabs testing simultaneously.
6. **Scoring: +5 for every standard/proper approach, -5 for every simplest-but-not-proper fix.**
7. **Research before coding — NO EXCEPTIONS** — before writing ANY fix that uses a third-party library: (1) web search for latest docs, AND (2) query Context7 MCP.

## Checklist Files

| File | Scope | Coverage |
| ------ | ------- | ---------- |
| [reseller-portal.md](reseller-portal.md) | `reseller.localhost:4200` | 51% (71/140) |
| [admin-portal.md](admin-portal.md) | `admin.localhost:4200` | 49% (20/41) |
| [institute-portal.md](institute-portal.md) | `localhost:4200` (default) | 33% (16/49) |
| [cross-portal-workflows.md](cross-portal-workflows.md) | Multi-portal flows | 29% (4/14) |
| [bugs-and-fixes.md](bugs-and-fixes.md) | All bugs found + fixes applied | 9 found, 9 fixed |

## User Workflow Docs

| File | Scope |
| ------ | ------- |
| [reseller-workflows.md](../pages/reseller-workflows.md) | Reseller admin user guide |
| [admin-workflows.md](../pages/admin-workflows.md) | Platform admin user guide |
| [institute-workflows.md](../pages/institute-workflows.md) | Institute user guide |

## Priority Order

1. **P0** — Cross-portal data creation flows (institute lifecycle, billing flow)
2. **P1** — Data mutation forms (create institute, plan CRUD, subscription lifecycle)
3. **P2** — Read flows + filters (audit logs, list pages)
4. **P3** — Auth edge cases + layout (invalid login, responsive, i18n)
