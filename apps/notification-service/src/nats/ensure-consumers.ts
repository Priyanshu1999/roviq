import { AckPolicy, jetstreamManager } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import { Logger } from '@nestjs/common';

const logger = new Logger('EnsureConsumers');

const CONSUMERS = [
  {
    stream: 'NOTIFICATION',
    durable: 'notification-attendance',
    filterSubject: 'NOTIFICATION.attendance.>',
  },
  {
    stream: 'NOTIFICATION',
    durable: 'notification-fee',
    filterSubject: 'NOTIFICATION.fee.>',
  },
  {
    stream: 'NOTIFICATION',
    durable: 'notification-approval',
    filterSubject: 'NOTIFICATION.approval.>',
  },
  {
    stream: 'NOTIFICATION',
    durable: 'notification-auth',
    filterSubject: 'NOTIFICATION.auth.>',
  },
  {
    stream: 'NOTIFICATION',
    durable: 'notification-user-sync',
    filterSubject: 'NOTIFICATION.user.>',
  },
] as const;

const MAX_DELIVER = 5;

export async function ensureConsumers(nc: NatsConnection): Promise<void> {
  const jsm = await jetstreamManager(nc);

  for (const c of CONSUMERS) {
    try {
      await jsm.consumers.info(c.stream, c.durable);
      logger.log(`Consumer "${c.durable}" already exists`);
    } catch {
      logger.log(`Creating consumer "${c.durable}" on stream "${c.stream}"`);
      await jsm.consumers.add(c.stream, {
        durable_name: c.durable,
        filter_subject: c.filterSubject,
        ack_policy: AckPolicy.Explicit,
        max_deliver: MAX_DELIVER,
      });
    }
  }
}
