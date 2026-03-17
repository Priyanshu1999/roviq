import {
  JetStreamApiError,
  jetstreamManager,
  RetentionPolicy,
  StorageType,
} from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import { Logger } from '@nestjs/common';
import type { StreamConfig } from '../interfaces/jetstream.options';

const logger = new Logger('JetStreamStreamManager');

const RETENTION_MAP: Record<StreamConfig['retention'], RetentionPolicy> = {
  workqueue: RetentionPolicy.Workqueue,
  limits: RetentionPolicy.Limits,
};

const STORAGE_MAP: Record<StreamConfig['storage'], StorageType> = {
  file: StorageType.File,
  memory: StorageType.Memory,
};

export async function ensureStreams(nc: NatsConnection, streams: StreamConfig[]): Promise<void> {
  const jsm = await jetstreamManager(nc);

  for (const stream of streams) {
    try {
      await jsm.streams.add({
        name: stream.name,
        subjects: [...stream.subjects],
        retention: RETENTION_MAP[stream.retention],
        storage: STORAGE_MAP[stream.storage],
      });
      logger.log(`Stream "${stream.name}" ensured`);
    } catch (err) {
      if (err instanceof JetStreamApiError && err.code === 10058) {
        try {
          await jsm.streams.update(stream.name, {
            subjects: [...stream.subjects],
          });
          logger.log(`Stream "${stream.name}" updated (config change on rolling deploy)`);
        } catch (updateErr) {
          logger.error(
            `Failed to update stream "${stream.name}". ` +
              'Immutable field change (retention/storage) requires manual migration.',
            updateErr,
          );
          throw updateErr;
        }
      } else {
        throw err;
      }
    }
  }
}
