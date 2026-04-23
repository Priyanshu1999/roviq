import { describe, expect, it } from 'vitest';
import type { JetStreamServerOptions } from '../../interfaces/jetstream.options';
import { resolveConsumerConfig } from '../resolve-consumer-config';

const BASE_OPTIONS: JetStreamServerOptions = {
  servers: ['nats://localhost:4222'],
  streams: [
    {
      name: 'NOTIFICATION',
      subjects: ['NOTIFICATION.>'],
      retention: 'interest',
      storage: 'file',
      maxDeliver: 5,
    },
  ],
};

describe('resolveConsumerConfig', () => {
  it('defaults ack_wait to 30s (expressed as 30e9 nanoseconds)', () => {
    const cfg = resolveConsumerConfig('NOTIFICATION.user.created', undefined, BASE_OPTIONS);
    expect(cfg.ackWaitNanos).toBe(30 * 1_000_000_000);
  });

  it('honours an override ackWait expressed in milliseconds', () => {
    const cfg = resolveConsumerConfig(
      'NOTIFICATION.user.created',
      { ackWait: 60_000 },
      BASE_OPTIONS,
    );
    // 60_000 ms × 1_000_000 ns/ms === 6 × 10^10 ns
    expect(cfg.ackWaitNanos).toBe(60_000 * 1_000_000);
  });

  it('pins ackWaitNanos so the boot-time drift diff catches mismatches', () => {
    // Regression guard for review #9b: if this unit ever returned 0 / null
    // for ackWaitNanos, the consumer-matches diff would silently pass even
    // when an out-of-band change set ack_wait on the live consumer. Keeping
    // a concrete positive ns value is the property the drift check relies on.
    const cfg = resolveConsumerConfig('NOTIFICATION.user.created', {}, BASE_OPTIONS);
    expect(cfg.ackWaitNanos).toBeGreaterThan(0);
    expect(Number.isInteger(cfg.ackWaitNanos)).toBe(true);
  });

  it('infers stream from the pattern prefix when no extras.stream is given', () => {
    const cfg = resolveConsumerConfig('AUDIT.log', undefined, BASE_OPTIONS);
    expect(cfg.stream).toBe('AUDIT');
    expect(cfg.durable).toBe('audit-log');
  });

  it('falls back through extras.maxDeliver → stream maxDeliver → 3', () => {
    const fromExtras = resolveConsumerConfig(
      'NOTIFICATION.user.created',
      { maxDeliver: 9 },
      BASE_OPTIONS,
    );
    expect(fromExtras.maxDeliver).toBe(9);

    const fromStream = resolveConsumerConfig('NOTIFICATION.user.created', undefined, BASE_OPTIONS);
    expect(fromStream.maxDeliver).toBe(5); // from BASE_OPTIONS.streams[0]

    const globalDefault = resolveConsumerConfig('OTHER.pattern', undefined, {
      ...BASE_OPTIONS,
      streams: [], // no stream config
    });
    expect(globalDefault.maxDeliver).toBe(3);
  });
});
