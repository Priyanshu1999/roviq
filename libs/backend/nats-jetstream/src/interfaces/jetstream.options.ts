export interface StreamConfig {
  name: string;
  subjects: readonly string[];
  retention: 'workqueue' | 'limits';
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
  concurrency?: number;
  handlerTimeout?: number;
  pull?: PullOptions;
}

export interface ResolvedConsumerConfig {
  stream: string;
  durable: string;
  maxDeliver: number;
  concurrency: number;
  handlerTimeout: number;
  pull: Required<PullOptions>;
}
