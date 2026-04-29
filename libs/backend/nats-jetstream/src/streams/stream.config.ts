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
    // `interest` (not `workqueue`) because overlapping filters are required:
    // `NOTIFICATION.user.created` is claimed by BOTH the welcome-email
    // listener (narrow filter) AND the Novu-subscriber-sync listener
    // (`NOTIFICATION.user.*` wildcard). Workqueue retention rejects
    // overlapping filters ("filtered consumer not unique on workqueue
    // stream") which crashed the service on every boot in environments
    // where the NOTIFICATION stream already existed.
    retention: 'interest',
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
  // Subject lifecycle (created / updated / deleted / assigned-to-standard /
  // assigned-to-section). Surfaced when subject + holiday + leave services
  // moved off `this.natsClient.emit(pattern, data)` (string variable hidden
  // from the streams-coverage check) to `eventBus.emit('SUBJECT.created', …)`
  // (string literal, now visible) — without these registry entries the publish
  // silently errored with "no stream matches subject".
  SUBJECT: {
    name: 'SUBJECT',
    subjects: ['SUBJECT.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  HOLIDAY: {
    name: 'HOLIDAY',
    subjects: ['HOLIDAY.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  LEAVE: {
    name: 'LEAVE',
    subjects: ['LEAVE.>'],
    retention: 'workqueue',
    storage: 'file',
    maxDeliver: 3,
  },
  RESELLER: {
    name: 'RESELLER',
    subjects: ['RESELLER.>'],
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
export const DEFAULT_DLQ_STREAM: StreamConfig = STREAMS.DLQ!;

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
