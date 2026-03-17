import type { JetStreamClient } from '@nats-io/jetstream';
import { headers as natsHeaders } from '@nats-io/nats-core';

export interface DlqMessage<T = unknown> {
  originalSubject: string;
  payload: T;
  error: string;
  retryCount: number;
  correlationId: string;
  tenantId?: string;
  failedAt: string;
}

export async function publishToDlq<T>(
  js: JetStreamClient,
  originalSubject: string,
  payload: T,
  error: string,
  retryCount: number,
  correlationId: string,
  tenantId?: string,
): Promise<void> {
  // biome-ignore lint/style/noNonNullAssertion: subject always has at least one segment
  const originStream = originalSubject.split('.')[0]!.toUpperCase();
  const dlqSubject = `DLQ.${originStream}`;

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
  // NATS headers cannot contain \r or \n — sanitize error messages
  hdrs.set('dlq-reason', error.replace(/[\r\n]+/g, ' ').slice(0, 512));

  await js.publish(dlqSubject, JSON.stringify(dlqPayload), { headers: hdrs });
}
