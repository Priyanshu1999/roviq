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
  SECTION: {
    name: 'SECTION',
    subjects: ['SECTION.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  STUDENT: {
    name: 'STUDENT',
    subjects: ['STUDENT.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  GROUP: {
    name: 'GROUP',
    subjects: ['GROUP.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  APPLICATION: {
    name: 'APPLICATION',
    subjects: ['APPLICATION.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  ENQUIRY: {
    name: 'ENQUIRY',
    subjects: ['ENQUIRY.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  ACADEMIC_YEAR: {
    name: 'ACADEMIC_YEAR',
    subjects: ['ACADEMIC_YEAR.>'],
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

/** Consumer config for the audit log writer (used by AuditConsumer in api-gateway) */
export const AUDIT_LOG_CONSUMER = {
  /** Durable name — survives consumer restarts */
  durable_name: 'audit-log-consumer',
  /** Only process audit.log events (not audit.error, audit.dlq) */
  filter_subject: 'audit.log',
  /** Each message must be explicitly acked */
  ack_policy: 'explicit',
  /** Max unacked messages before back-pressure kicks in */
  max_ack_pending: 1000,
  /** Max delivery attempts before terminal (sent to DLQ) */
  max_deliver: 5,
} as const;
