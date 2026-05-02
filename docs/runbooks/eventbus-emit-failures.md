# EventBus emit-failure spike

## Symptom

Grafana alert `EventBusEmitFailuresWarning` (or `…Critical`) firing —
sustained `event_bus_emit_failed_total` rate above threshold for one or
more `subject_prefix` labels.

User-facing impact depends on which prefix is failing — if it's
`AUDIT.*` the audit pipeline is dropping rows; if `NOTIFICATION.*` users
won't receive notifications; if `BILLING.*` payment-state events are
lost.

## What it means

`EventBusService.emit` is fire-and-forget by design — the resolver
finishes successfully even if the NATS publish fails, so users don't
see errors. The metric is the only operational signal.

Causes, in rough order of likelihood:

1. **NATS connectivity** — broker down, network partition, stale TCP
   connection in the api-gateway pool.
2. **JetStream stream missing** — a new emit subject was added without
   a matching `STREAMS.X` entry. Item-1's typing should have caught
   this at compile time; if you see it in prod, the deploy somehow
   shipped without the registry entry.
3. **Stream config drift** — `STREAMS.X` was edited and a deploy hit
   the boot drift gate (`assertDriftRecreateAllowed`). Stream is in an
   inconsistent state until the maintenance-window recreate.
4. **JetStream cluster overload** — disk full, max stream size
   exceeded.

## Triage commands

Run from a host with `nats` CLI + cluster credentials.

```bash
# 1. Which subjects are failing? (requires Loki query against api-gateway logs)
#    Look for the structured log:
#      { "event_bus.emit.failed": true, "event_bus.subject_prefix": "AUDIT" }
#
#    Or via Grafana → Explore → log query:
#      {service="api-gateway"} | json | event_bus_emit_failed = "true"
#      | line_format "{{.event_bus_subject}}"

# 2. NATS cluster health
nats --server $NATS_URL server check connection
nats --server $NATS_URL server info

# 3. Stream-level info — replace AUDIT with the failing prefix
nats --server $NATS_URL stream info AUDIT
nats --server $NATS_URL stream report

# 4. Are publishes being rejected? Look for `Bytes` not advancing.
nats --server $NATS_URL stream info AUDIT --json | jq '.state'

# 5. Is the stream definition still in sync with source?
NATS_URL=$NATS_URL pnpm check:jetstream-drift
```

## Mitigations

### NATS down (cause 1)

- Check the cluster's pod status (k8s) / health-check (managed NATS
  service). Restart unhealthy nodes.
- Once recovered, the api-gateway's NATS client reconnects
  automatically; the metric returns to baseline within ~1 minute.
- **No data backfill** — fire-and-forget emits during the outage are
  lost. Audit if `AUDIT.*` was affected (see ROV-252 runbook).

### Stream missing (cause 2)

- Confirm via `nats stream ls` — is the named stream actually missing?
- Cross-check `STREAMS` in
  [stream.config.ts](../../libs/backend/nats-jetstream/src/streams/stream.config.ts).
- If source has the entry but the cluster doesn't: re-deploy the
  api-gateway. `ensureStreams` runs at boot and `streams.add` is
  idempotent.
- If source is missing the entry: emergency PR to add it, then deploy.

### Stream config drift (cause 3)

- Run `pnpm check:jetstream-drift` against the failing cluster.
- If drift detected: see [stream-migrations.md](./stream-migrations.md)
  for the recreate procedure.

### Cluster overload (cause 4)

- `nats stream report` — which stream is largest?
- If a stream has unbounded growth: check for a stuck consumer
  (`nats consumer info <stream> <consumer>` → `num_pending`). Restart
  the consumer if its handler is hanging.
- Bump the cluster's disk allocation OR purge old messages
  (`nats stream purge <stream>` — destructive, only if you understand
  the retention contract).

## After the incident

1. Confirm `event_bus_emit_failed_total` rate has returned to baseline
   for ~15 minutes.
2. If the cause was a stream-config issue, file a follow-up PR to make
   the misconfig impossible (e.g. tightening `check:jetstream-drift`
   to catch the missed case).
3. Append to `docs/changelogs/testing-troubleshooting.md` with date,
   trigger, root cause, fix.

## Related

- Source: `apps/api-gateway/src/common/event-bus.service.ts`
- Alert rule: `docs/observability/alerts/eventbus-emit-failures.yaml`
- Dashboard: `docs/observability/dashboards/event-bus.json`
- Linear: ROV-257
