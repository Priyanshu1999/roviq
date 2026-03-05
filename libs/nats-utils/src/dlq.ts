import { jetstream } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/transport-node';
import { headers as natsHeaders } from '@nats-io/transport-node';

export interface DlqMessage<T = unknown> {
  originalSubject: string;
  payload: T;
  error: string;
  retryCount: number;
  correlationId: string;
  tenantId: string;
  failedAt: string;
}

export async function publishToDlq<T>(
  nc: NatsConnection,
  originalSubject: string,
  payload: T,
  error: string,
  retryCount: number,
  correlationId: string,
  tenantId: string,
): Promise<void> {
  const js = jetstream(nc);
  const dlqSubject = `${originalSubject}.DLQ`;

  const dlqPayload: DlqMessage<T> = {
    originalSubject,
    payload,
    error,
    retryCount,
    correlationId,
    tenantId,
    failedAt: new Date().toISOString(),
  };

  const hdrs = natsHeaders();
  hdrs.set('correlation-id', correlationId);
  if (tenantId) {
    hdrs.set('tenant-id', tenantId);
  }
  hdrs.set('dlq-reason', error);

  await js.publish(dlqSubject, JSON.stringify(dlqPayload), { headers: hdrs });
}
