import type { StreamConfig } from '../interfaces/jetstream.options';

export const STREAMS: Record<string, StreamConfig> = {
  INSTITUTE: {
    name: 'INSTITUTE',
    subjects: ['INSTITUTE.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  ADMIN: {
    name: 'ADMIN',
    subjects: ['ADMIN.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  NOTIFICATION: {
    name: 'NOTIFICATION',
    subjects: ['NOTIFICATION.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 5,
  },
  AUDIT: {
    name: 'AUDIT',
    subjects: ['AUDIT.>'],
    retention: 'limits',
    storage: 'file',
    maxDeliver: 5,
  },
  BILLING: {
    name: 'BILLING',
    subjects: ['BILLING.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  DLQ: {
    name: 'DLQ',
    subjects: ['DLQ.>'],
    retention: 'limits',
    storage: 'file',
    maxDeliver: 1,
  },
};

// biome-ignore lint/style/noNonNullAssertion: DLQ is always defined in STREAMS above
// biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires bracket access
export const DEFAULT_DLQ_STREAM: StreamConfig = STREAMS['DLQ']!;
