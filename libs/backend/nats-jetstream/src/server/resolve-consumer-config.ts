import type {
  ConsumerExtras,
  JetStreamServerOptions,
  ResolvedConsumerConfig,
} from '../interfaces/jetstream.options';

/**
 * Resolve a consumer's runtime config from the `@EventPattern` decorator's
 * pattern + extras, against the server-wide `JetStreamServerOptions`.
 *
 * Extracted from `JetStreamServer` so the defaulting logic (especially the
 * `ack_wait` ns pinning that the boot-time `matches` drift-check relies on)
 * can be unit-tested without spinning up a NATS connection.
 */
export function resolveConsumerConfig(
  pattern: string,
  extras: ConsumerExtras | undefined,
  jsOptions: JetStreamServerOptions,
): ResolvedConsumerConfig {
  // biome-ignore lint/style/noNonNullAssertion: pattern always has at least one segment
  const inferredStream = pattern.split('.')[0]!.toUpperCase();
  const stream = extras?.stream ?? inferredStream;

  const durable = extras?.durable ?? pattern.replace(/[.>*]/g, '-').toLowerCase();

  // Find maxDeliver from the matching stream config, or default to 3
  const streamConfig = jsOptions.streams.find((s) => s.name === stream);
  const maxDeliver = extras?.maxDeliver ?? streamConfig?.maxDeliver ?? 3;

  const concurrency = extras?.concurrency ?? 1;
  const handlerTimeout = extras?.handlerTimeout ?? 25_000;

  // Pin `ack_wait` to a concrete ns value so the boot-time drift check
  // has something exact to compare against. Default mirrors the NATS
  // server default (30 s) — consumers that need a longer hold (e.g. slow
  // external API calls inside a handler) override via
  // `@EventPattern(..., { ackWait: 60_000 })` in ms.
  const ackWaitMs = extras?.ackWait ?? 30_000;
  const ackWaitNanos = ackWaitMs * 1_000_000;

  const globalPull = jsOptions.pull;
  const pull = {
    batchSize: extras?.pull?.batchSize ?? globalPull?.batchSize ?? 10,
    idleHeartbeat: extras?.pull?.idleHeartbeat ?? globalPull?.idleHeartbeat ?? 30_000,
    expires: extras?.pull?.expires ?? globalPull?.expires ?? 60_000,
  };

  return {
    stream,
    durable,
    maxDeliver,
    ackWaitNanos,
    concurrency,
    handlerTimeout,
    pull,
  };
}
