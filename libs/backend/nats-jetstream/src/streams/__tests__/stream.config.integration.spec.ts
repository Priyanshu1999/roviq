import { jetstream, jetstreamManager } from '@nats-io/jetstream';
import type { NatsConnection } from '@nats-io/nats-core';
import { connect } from '@nats-io/transport-node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { STREAMS } from '../stream.config';
import { ensureStreams } from '../stream.manager';

/**
 * ROV-221 integration test: connects to a real NATS instance, ensures all
 * streams from STREAMS, then publishes to each of the 6 newly added subject
 * prefixes and asserts the publish lands in the correct stream.
 *
 * Requires a running NATS server. Defaults to nats://localhost:4222 — override
 * via NATS_URL. Run via `pnpm vitest run --project integration`.
 */
const NATS_URL = process.env['NATS_URL'] ?? 'nats://localhost:4222';

describe('STREAMS runtime ensure (ROV-221)', () => {
  let nc: NatsConnection;

  beforeAll(async () => {
    nc = await connect({ servers: NATS_URL });
    // Clean up any pre-existing streams from prior runs to start fresh
    const jsm = await jetstreamManager(nc);
    for (const s of Object.values(STREAMS)) {
      try {
        await jsm.streams.delete(s.name);
      } catch {
        // ignore - stream may not exist
      }
    }
  }, 30_000);

  afterAll(async () => {
    if (nc) await nc.drain();
  });

  it('ensures all streams without error', async () => {
    await expect(ensureStreams(nc, Object.values(STREAMS))).resolves.toBeUndefined();
  });

  it('lists all streams declared in STREAMS', async () => {
    const jsm = await jetstreamManager(nc);
    const names: string[] = [];
    for await (const s of jsm.streams.list()) {
      names.push(s.config.name);
    }
    for (const name of Object.keys(STREAMS)) {
      expect(names).toContain(name);
    }
  });

  it.each([
    ['SECTION', 'SECTION.created'],
    ['STUDENT', 'STUDENT.enrolled'],
    ['GROUP', 'GROUP.rules_updated'],
    ['APPLICATION', 'APPLICATION.status_changed'],
    ['ENQUIRY', 'ENQUIRY.created'],
    ['ACADEMIC_YEAR', 'ACADEMIC_YEAR.activated'],
  ])('publishes %s subject to its dedicated stream', async (streamName, subject) => {
    const js = jetstream(nc);
    const ack = await js.publish(subject, new TextEncoder().encode(JSON.stringify({ test: true })));
    expect(ack.stream).toBe(streamName);
    expect(ack.seq).toBeGreaterThan(0);
  });
});
