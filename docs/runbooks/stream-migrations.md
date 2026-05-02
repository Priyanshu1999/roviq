# JetStream Stream Migrations

JetStream forbids in-place changes to a stream's `retention` or `storage`
policy. Changing `subjects` is in-place mutable; everything else needs a
delete + recreate, which **drops un-acked messages**. This runbook
documents the safe migration sequence.

## Layered defense

1. **Source of truth** — `libs/backend/nats-jetstream/src/streams/stream.config.ts`
   declares every stream. PRs that touch this file own the migration.
2. **Pre-deploy gate** — `pnpm check:jetstream-drift` (run in the e2e-api
   CI job) compares source against the e2e NATS stack. A PR that changes
   `STREAMS.X.retention` without a coordinated deploy plan fails CI.
3. **Boot-time gate** — `assertDriftRecreateAllowed`
   ([drift-gate.ts](../../libs/backend/nats-jetstream/src/streams/drift-gate.ts))
   refuses to silently recreate a drifted stream at api-gateway boot.
   Set `NATS_STREAM_DRIFT_RECREATE=true` only inside a maintenance window.

## When the CI gate fires

Output looks like:

```
check:jetstream-drift — 1 drift(s) detected at nats://localhost:4222:

  STUDENT.retention
    source:   limits
    deployed: workqueue
```

You have two paths:

### Option A — Revert the source change

If the change was unintentional, revert the `STREAMS.X` edit. The gate
passes again on the next CI run; nothing to deploy.

### Option B — Coordinated migration

If the change is intentional (e.g. moving from `workqueue` to `interest`
because a second consumer needs fanout):

1. **Drain the stream** in production:
   - Stop emitters for the affected prefix (feature-flag the producer
     code path off, OR scale producer replicas to zero).
   - Wait until consumers ack everything currently in the stream
     (`nats consumer info <stream> <consumer>` → `num_pending: 0`).
2. **Schedule maintenance window** — communicate downtime, since the
   stream will briefly not exist between delete and recreate.
3. **Deploy api-gateway with the gate enabled**:
   ```
   NATS_STREAM_DRIFT_RECREATE=true
   ```
   Boot logs will show:
   ```
   Stream "STUDENT" drift detected (retention workqueue → limits) —
     destroying and recreating per NATS_STREAM_DRIFT_RECREATE=true
   ```
4. **Re-enable producers**.
5. **Unset `NATS_STREAM_DRIFT_RECREATE`** on the next deploy. Leaving it
   on is dangerous — a future accidental drift would silently destroy
   un-acked messages.
6. **Confirm** post-deploy: `pnpm check:jetstream-drift` against staging
   shows no drift.

## When `pnpm check:jetstream-drift` reports an `orphan`

A stream exists on the cluster but isn't in source `STREAMS`. Two
possibilities:

- Leftover from a deleted feature → delete the stream:
  `nats stream rm <name>` (after confirming no producer/consumer code
  references it).
- Source was edited and the entry removed — re-add to `STREAMS` if the
  feature is still live, or commit to the deletion via the path above.

## Local testing

Reproduce the gate locally:

```bash
pnpm e2e:up                                    # brings up NATS at :4222
# edit STREAMS.STUDENT.retention to a different value
pnpm check:jetstream-drift                     # → exits 1 with a clear diff
# revert
pnpm check:jetstream-drift                     # → exits 0
```

## Related

- Source of truth: `libs/backend/nats-jetstream/src/streams/stream.config.ts`
- Boot gate: `libs/backend/nats-jetstream/src/streams/drift-gate.ts`
- CI gate: `scripts/check-jetstream-drift.ts`
- Linear: ROV-255 (this runbook), ROV-245 (stream registry origin)
