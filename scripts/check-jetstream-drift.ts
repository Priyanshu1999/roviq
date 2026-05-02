// CI guard — diff source `STREAMS` config against a live NATS JetStream
// instance and fail on any mismatch. Catches retention/storage/subjects
// drift BEFORE it reaches production where `assertDriftRecreateAllowed`
// would either crash the api-gateway boot or destructively recreate the
// stream (dropping un-acked messages).
//
// Run against the e2e Docker stack already brought up by the e2e-api job:
//   pnpm e2e:up && pnpm check:jetstream-drift
//
// Set `NATS_URL` to point elsewhere (e.g. a staging cluster):
//   NATS_URL=nats://staging-nats:4222 pnpm check:jetstream-drift

import {
  type JetStreamManager,
  jetstreamManager,
  RetentionPolicy,
  StorageType,
} from '@nats-io/jetstream';
import { connect } from '@nats-io/transport-node';
import type { StreamConfig } from '../libs/backend/nats-jetstream/src/interfaces/jetstream.options';
import { STREAMS } from '../libs/backend/nats-jetstream/src/streams/stream.config';

const NATS_URL = process.env.NATS_URL ?? 'nats://localhost:4222';

const RETENTION_MAP: Record<StreamConfig['retention'], RetentionPolicy> = {
  workqueue: RetentionPolicy.Workqueue,
  limits: RetentionPolicy.Limits,
  interest: RetentionPolicy.Interest,
};

const STORAGE_MAP: Record<StreamConfig['storage'], StorageType> = {
  file: StorageType.File,
  memory: StorageType.Memory,
};

interface Drift {
  stream: string;
  field: 'subjects' | 'retention' | 'storage' | 'maxConsumerDeliver' | 'missing' | 'orphan';
  source: string;
  deployed: string;
}

function isNotFound(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  return code === '404' || /not found/i.test(String((err as Error).message));
}

async function diffStream(jsm: JetStreamManager, stream: StreamConfig): Promise<Drift[]> {
  const drifts: Drift[] = [];
  let info: Awaited<ReturnType<typeof jsm.streams.info>>;
  try {
    info = await jsm.streams.info(stream.name);
  } catch (err) {
    if (isNotFound(err)) {
      return [
        {
          stream: stream.name,
          field: 'missing',
          source: `subjects=${JSON.stringify(stream.subjects)} retention=${stream.retention}`,
          deployed: '(not deployed)',
        },
      ];
    }
    throw err;
  }

  const deployedSubjects = [...(info.config.subjects ?? [])].sort();
  const sourceSubjects = [...stream.subjects].sort();
  if (JSON.stringify(deployedSubjects) !== JSON.stringify(sourceSubjects)) {
    drifts.push({
      stream: stream.name,
      field: 'subjects',
      source: JSON.stringify(sourceSubjects),
      deployed: JSON.stringify(deployedSubjects),
    });
  }

  const desiredRetention = RETENTION_MAP[stream.retention];
  if (info.config.retention !== desiredRetention) {
    drifts.push({
      stream: stream.name,
      field: 'retention',
      source: stream.retention,
      deployed: String(info.config.retention),
    });
  }

  const desiredStorage = STORAGE_MAP[stream.storage];
  if (info.config.storage !== desiredStorage) {
    drifts.push({
      stream: stream.name,
      field: 'storage',
      source: stream.storage,
      deployed: String(info.config.storage),
    });
  }

  // The stream-level `maxDeliver` is an UPPER bound — individual consumers
  // may choose a lower value, but exceeding the contract would let a poison
  // message redeliver past the DLQ threshold.
  const consumers = await jsm.consumers.list(stream.name).next();
  for (const consumer of consumers) {
    const cMax = consumer.config.max_deliver;
    if (typeof cMax === 'number' && cMax > 0 && cMax > stream.maxDeliver) {
      drifts.push({
        stream: stream.name,
        field: 'maxConsumerDeliver',
        source: `≤ ${stream.maxDeliver} (per stream contract)`,
        deployed: `${cMax} (consumer ${consumer.name})`,
      });
    }
  }

  return drifts;
}

async function findOrphans(jsm: JetStreamManager): Promise<Drift[]> {
  const sourceNames = new Set(Object.values(STREAMS).map((s) => s.name));
  const allDeployed = await jsm.streams.list().next();
  return allDeployed
    .filter((d) => !sourceNames.has(d.config.name))
    .map((d) => ({
      stream: d.config.name,
      field: 'orphan' as const,
      source: '(not in STREAMS)',
      deployed: `subjects=${JSON.stringify(d.config.subjects)}`,
    }));
}

function reportDrifts(drifts: Drift[]): void {
  if (drifts.length === 0) {
    console.log(
      `check:jetstream-drift — ${Object.keys(STREAMS).length} streams in source, all match deployed at ${NATS_URL}.`,
    );
    return;
  }

  console.error(`check:jetstream-drift — ${drifts.length} drift(s) detected at ${NATS_URL}:\n`);
  for (const d of drifts) {
    console.error(`  ${d.stream}.${d.field}`);
    console.error(`    source:   ${d.source}`);
    console.error(`    deployed: ${d.deployed}`);
  }
  console.error(
    '\n  Retention/storage drift is destructive to fix — see docs/runbooks/stream-migrations.md\n' +
      '  for the maintenance-window procedure (set NATS_STREAM_DRIFT_RECREATE=true after\n' +
      '  draining the affected stream).',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const nc = await connect({ servers: NATS_URL, timeout: 5_000 });
  try {
    const jsm = await jetstreamManager(nc);
    const drifts: Drift[] = [];
    for (const stream of Object.values(STREAMS)) {
      drifts.push(...(await diffStream(jsm, stream)));
    }
    drifts.push(...(await findOrphans(jsm)));
    reportDrifts(drifts);
  } finally {
    await nc.drain();
  }
}

main().catch((err) => {
  console.error(`check:jetstream-drift — failed to connect/query: ${(err as Error).message}`);
  process.exit(2);
});
