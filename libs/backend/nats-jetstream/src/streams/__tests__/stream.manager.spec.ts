import { describe, expect, it } from 'vitest';
import { DEFAULT_DLQ_STREAM, STREAMS } from '../stream.config';

describe('STREAMS config', () => {
  it('defines all expected streams', () => {
    expect(Object.keys(STREAMS)).toEqual(
      expect.arrayContaining(['INSTITUTE', 'ADMIN', 'NOTIFICATION', 'AUDIT', 'BILLING', 'DLQ']),
    );
  });

  it('defines exactly 6 streams', () => {
    expect(Object.keys(STREAMS)).toHaveLength(6);
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
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires bracket access
    expect(STREAMS['BILLING']).toMatchObject({
      name: 'BILLING',
      subjects: ['BILLING.>'],
      retention: 'workqueue',
      storage: 'file',
      maxDeliver: 3,
    });
  });

  it('DLQ stream uses limits retention and maxDeliver 1', () => {
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires bracket access
    expect(STREAMS['DLQ']).toMatchObject({
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
    // biome-ignore lint/complexity/useLiteralKeys: TS noPropertyAccessFromIndexSignature requires bracket access
    expect(DEFAULT_DLQ_STREAM).toBe(STREAMS['DLQ']);
  });

  it('has name DLQ', () => {
    expect(DEFAULT_DLQ_STREAM.name).toBe('DLQ');
  });
});
