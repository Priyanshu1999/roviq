// @roviq/nats-jetstream — NestJS JetStream custom transport

// Client
export { JetStreamClient } from './client/jetstream.client';
// Context
export { JetStreamContext, type JetStreamMeta } from './context/jetstream.context';
// DLQ
export { type DlqMessage, publishToDlq } from './dlq/dlq.handler';
// Types
export type {
  ConsumerExtras,
  DlqOptions,
  JetStreamServerOptions,
  PullOptions,
  ResolvedConsumerConfig,
  RetryOptions,
  StreamConfig,
} from './interfaces/jetstream.options';
export { DeserializationError, HandlerTimeoutError } from './server/errors';
// Server
export { JetStreamServer } from './server/jetstream.server';
// Streams
export { DEFAULT_DLQ_STREAM, STREAMS } from './streams/stream.config';
export { ensureStreams } from './streams/stream.manager';
