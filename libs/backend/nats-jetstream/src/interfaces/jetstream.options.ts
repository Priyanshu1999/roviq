export interface StreamConfig {
  name: string;
  subjects: readonly string[];
  /**
   * Retention policy:
   *  - `workqueue` — each message delivered to exactly ONE consumer across
   *    the stream; overlapping consumer filters are rejected. Right for
   *    commands/jobs where a single worker handles each event.
   *  - `interest` — each message delivered to every consumer whose filter
   *    matches; retained until all interested consumers ack. Right for
   *    fanout (`NOTIFICATION.user.created` needs both the welcome-email
   *    listener AND the Novu-subscriber-sync listener).
   *  - `limits` — retained by count/size/age regardless of consumer state.
   */
  retention: 'workqueue' | 'limits' | 'interest';
  storage: 'file' | 'memory';
  maxDeliver: number;
}

export interface DlqOptions {
  enabled: boolean;
  stream?: string;
}

export interface PullOptions {
  batchSize?: number;
  idleHeartbeat?: number;
  expires?: number;
}

export interface RetryOptions {
  baseDelay?: number;
  maxDelay?: number;
}

export interface JetStreamServerOptions {
  servers: string[];
  streams: StreamConfig[];
  dlq?: DlqOptions;
  contextPropagation?: boolean;
  pull?: PullOptions;
  retry?: RetryOptions;
}

export interface ConsumerExtras {
  stream?: string;
  durable?: string;
  maxDeliver?: number;
  /**
   * How long NATS waits for an `ack` before re-delivering a message.
   * Overrides the library default of 30 s. Pinned per-consumer (not
   * defaulted to the NATS server's value) so the boot-time `matches`
   * drift check can compare against the exact ns count we asked for —
   * otherwise fabricating a server-default comparison would either
   * rebuild every consumer every boot or let real drift pass silently.
   */
  ackWait?: number;
  concurrency?: number;
  handlerTimeout?: number;
  pull?: PullOptions;
}

export interface ResolvedConsumerConfig {
  stream: string;
  durable: string;
  maxDeliver: number;
  /** Ack-wait window in nanoseconds (the unit `@nats-io/jetstream` takes). */
  ackWaitNanos: number;
  concurrency: number;
  handlerTimeout: number;
  pull: Required<PullOptions>;
}
