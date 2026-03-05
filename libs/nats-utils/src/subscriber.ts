import { jetstream } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/transport-node';
import { publishToDlq } from './dlq.js';

export interface SubscribeOptions {
  stream: string;
  subject: string;
  durableName: string;
  maxRetries?: number;
}

export interface MessageMeta {
  correlationId: string;
  tenantId: string;
}

export async function subscribe<T>(
  nc: NatsConnection,
  options: SubscribeOptions,
  handler: (payload: T, meta: MessageMeta) => Promise<void>,
): Promise<void> {
  const js = jetstream(nc);
  const maxRetries = options.maxRetries ?? 3;
  const consumer = await js.consumers.get(options.stream, options.durableName);
  const messages = await consumer.consume();

  for await (const msg of messages) {
    const correlationId = msg.headers?.get('correlation-id') ?? 'unknown';
    const tenantId = msg.headers?.get('tenant-id') ?? '';
    const payload = msg.json<T>();
    const redeliveryCount = msg.info.deliveryCount ?? 1;

    try {
      await handler(payload, { correlationId, tenantId });
      msg.ack();
    } catch (err) {
      if (redeliveryCount >= maxRetries) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await publishToDlq(
          nc,
          msg.subject,
          payload,
          errorMessage,
          redeliveryCount,
          correlationId,
          tenantId,
        );
        msg.term();
      } else {
        msg.nak();
      }
    }
  }
}
