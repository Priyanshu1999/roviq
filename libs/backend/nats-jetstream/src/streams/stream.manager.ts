import {
  JetStreamApiError,
  jetstreamManager,
  RetentionPolicy,
  StorageType,
} from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import { Logger } from '@nestjs/common';
import type { StreamConfig } from '../interfaces/jetstream.options';
import { assertDriftRecreateAllowed } from './drift-gate';

const logger = new Logger('JetStreamStreamManager');

const RETENTION_MAP: Record<StreamConfig['retention'], RetentionPolicy> = {
  workqueue: RetentionPolicy.Workqueue,
  limits: RetentionPolicy.Limits,
  interest: RetentionPolicy.Interest,
};

const STORAGE_MAP: Record<StreamConfig['storage'], StorageType> = {
  file: StorageType.File,
  memory: StorageType.Memory,
};

export async function ensureStreams(nc: NatsConnection, streams: StreamConfig[]): Promise<void> {
  const jsm = await jetstreamManager(nc);

  for (const stream of streams) {
    const desiredRetention = RETENTION_MAP[stream.retention];
    const desiredStorage = STORAGE_MAP[stream.storage];

    try {
      await jsm.streams.add({
        name: stream.name,
        subjects: [...stream.subjects],
        retention: desiredRetention,
        storage: desiredStorage,
      });
      logger.log(`Stream "${stream.name}" ensured`);
      continue;
    } catch (err) {
      if (!(err instanceof JetStreamApiError && err.code === 10058)) {
        throw err;
      }
    }

    // Stream exists — diff against the live config. NATS lets us mutate
    // subjects in place but flatly rejects a retention/storage change.
    // When that drifts, delete+recreate is the only option, but it drops
    // un-acked messages — so gate it behind NATS_STREAM_DRIFT_RECREATE.
    // Default (unset) throws with a clear migration hint.
    const existing = await jsm.streams.info(stream.name);
    const retentionDrift = existing.config.retention !== desiredRetention;
    const storageDrift = existing.config.storage !== desiredStorage;

    if (retentionDrift || storageDrift) {
      assertDriftRecreateAllowed(
        logger,
        `Stream "${stream.name}"`,
        `retention ${existing.config.retention} → ${desiredRetention}, ` +
          `storage ${existing.config.storage} → ${desiredStorage}`,
      );
      await jsm.streams.delete(stream.name);
      await jsm.streams.add({
        name: stream.name,
        subjects: [...stream.subjects],
        retention: desiredRetention,
        storage: desiredStorage,
      });
      logger.log(`Stream "${stream.name}" recreated with new retention/storage`);
      continue;
    }

    try {
      await jsm.streams.update(stream.name, { subjects: [...stream.subjects] });
      logger.log(`Stream "${stream.name}" updated (subject list refreshed)`);
    } catch (updateErr) {
      logger.error(`Failed to update stream "${stream.name}" after drift check`, updateErr);
      throw updateErr;
    }
  }
}
