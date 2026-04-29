import { describe, expect, it } from 'vitest';
import { DEFAULT_DLQ_STREAM, STREAMS } from '../stream.config';

describe('STREAMS config', () => {
  // Domain streams that publishers (services) emit to. Each MUST be registered
  // here, otherwise `EventBusService.emit()` will silently drop messages
  // (fire-and-forget with no JetStream consumer).
  const EXPECTED_DOMAIN_STREAMS = [
    'INSTITUTE',
    'ADMIN',
    'NOTIFICATION',
    'AUDIT',
    'BILLING',
    'SECTION',
    'STUDENT',
    'GROUP',
    'APPLICATION',
    'ENQUIRY',
    'ACADEMIC_YEAR',
    'SUBJECT',
    'HOLIDAY',
    'LEAVE',
    'RESELLER',
  ] as const;
  // Infra stream — dead-letter queue for any of the above.
  const INFRA_STREAMS = ['DLQ'] as const;
  const EXPECTED_STREAMS = [...EXPECTED_DOMAIN_STREAMS, ...INFRA_STREAMS];

  it('defines all expected streams', () => {
    expect(Object.keys(STREAMS)).toEqual(expect.arrayContaining([...EXPECTED_STREAMS]));
  });

  it('defines exactly the expected streams (no orphans, no missing)', () => {
    expect(Object.keys(STREAMS).sort()).toEqual([...EXPECTED_STREAMS].sort());
  });

  it('all stream names are uppercase', () => {
    for (const stream of Object.values(STREAMS)) {
      expect(stream.name).toBe(stream.name.toUpperCase());
    }
  });

  it('all subjects follow STREAM_NAME.> pattern', () => {
    for (const stream of Object.values(STREAMS)) {
      expect(stream.subjects[0]).toBe(`${stream.name}.>`);
    }
  });

  it('all streams use file storage', () => {
    for (const stream of Object.values(STREAMS)) {
      expect(stream.storage).toBe('file');
    }
  });

  it('BILLING stream is defined with workqueue retention', () => {
    expect(STREAMS.BILLING).toMatchObject({
      name: 'BILLING',
      subjects: ['BILLING.>'],
      retention: 'workqueue',
      storage: 'file',
      maxDeliver: 3,
    });
  });

  it('DLQ stream uses limits retention and maxDeliver 1', () => {
    expect(STREAMS.DLQ).toMatchObject({
      name: 'DLQ',
      subjects: ['DLQ.>'],
      retention: 'limits',
      storage: 'file',
      maxDeliver: 1,
    });
  });
});

describe('DEFAULT_DLQ_STREAM', () => {
  it('is a reference to STREAMS.DLQ', () => {
    expect(DEFAULT_DLQ_STREAM).toBe(STREAMS.DLQ);
  });

  it('has name DLQ', () => {
    expect(DEFAULT_DLQ_STREAM.name).toBe('DLQ');
  });
});
