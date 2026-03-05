import { jetstream } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/transport-node';
import { headers as natsHeaders } from '@nats-io/transport-node';

export interface PublishOptions {
  correlationId: string;
  tenantId?: string;
}

export async function publish<T>(
  nc: NatsConnection,
  subject: string,
  payload: T,
  options: PublishOptions,
): Promise<void> {
  const js = jetstream(nc);
  const hdrs = natsHeaders();
  hdrs.set('correlation-id', options.correlationId);
  if (options.tenantId) {
    hdrs.set('tenant-id', options.tenantId);
  }

  await js.publish(subject, JSON.stringify(payload), { headers: hdrs });
}
