import { jetstreamManager, RetentionPolicy, StorageType } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';

export const STREAMS = {
  INSTITUTE: {
    name: 'INSTITUTE',
    subjects: ['INSTITUTE.>'],
    retention: 'workqueue' as const,
    storage: 'file' as const,
    maxDeliver: 3,
  },
  ADMIN: {
    name: 'ADMIN',
    subjects: ['ADMIN.>'],
    retention: 'workqueue' as const,
    storage: 'file' as const,
    maxDeliver: 3,
  },
  NOTIFICATION: {
    name: 'NOTIFICATION',
    subjects: ['NOTIFICATION.>'],
    retention: 'workqueue' as const,
    storage: 'file' as const,
    maxDeliver: 5,
  },
  AUDIT: {
    name: 'AUDIT',
    subjects: ['AUDIT.>'],
    retention: 'limits' as const,
    storage: 'file' as const,
    maxDeliver: 5,
  },
  DLQ: {
    name: 'DLQ',
    subjects: ['DLQ.>'],
    retention: 'limits' as const,
    storage: 'file' as const,
    maxDeliver: 1,
  },
} as const;

export async function ensureStreams(nc: NatsConnection): Promise<void> {
  const jsm = await jetstreamManager(nc);
  for (const stream of Object.values(STREAMS)) {
    try {
      await jsm.streams.info(stream.name);
    } catch {
      const retention =
        stream.retention === 'limits' ? RetentionPolicy.Limits : RetentionPolicy.Workqueue;
      await jsm.streams.add({
        name: stream.name,
        subjects: [...stream.subjects],
        retention,
        storage: StorageType.File,
      });
    }
  }
}
