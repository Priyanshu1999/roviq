import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertDriftRecreateAllowed } from '../drift-gate';

describe('assertDriftRecreateAllowed', () => {
  const ORIGINAL = process.env.NATS_STREAM_DRIFT_RECREATE;
  let logger: Logger;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new Logger('drift-gate-test');
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.NATS_STREAM_DRIFT_RECREATE;
    } else {
      process.env.NATS_STREAM_DRIFT_RECREATE = ORIGINAL;
    }
  });

  it('permits recreation with a warn when NATS_STREAM_DRIFT_RECREATE=true', () => {
    process.env.NATS_STREAM_DRIFT_RECREATE = 'true';

    expect(() =>
      assertDriftRecreateAllowed(logger, 'Stream "FOO"', 'retention workqueue → interest'),
    ).not.toThrow();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [msg] = warnSpy.mock.calls[0] ?? [];
    expect(msg).toContain('Stream "FOO" drift detected');
    expect(msg).toContain('retention workqueue → interest');
    expect(msg).toContain('NATS_STREAM_DRIFT_RECREATE=true');
    expect(msg).toContain('un-acked messages');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('blocks recreation with an error+throw when NATS_STREAM_DRIFT_RECREATE is unset', () => {
    delete process.env.NATS_STREAM_DRIFT_RECREATE;

    expect(() =>
      assertDriftRecreateAllowed(logger, 'Stream "NOTIFICATION"', 'retention interest → workqueue'),
    ).toThrow(/NATS_STREAM_DRIFT_RECREATE=true/);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg] = errorSpy.mock.calls[0] ?? [];
    expect(msg).toContain('Stream "NOTIFICATION" drift detected');
    expect(msg).toContain('retention interest → workqueue');
    expect(msg).toContain('Set NATS_STREAM_DRIFT_RECREATE=true');
    expect(msg).toContain('DANGER: drops un-acked messages');
    expect(msg).toContain('migrate manually');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('blocks recreation for any value that is not the literal string "true"', () => {
    for (const value of ['1', 'yes', 'TRUE', 'false', '']) {
      process.env.NATS_STREAM_DRIFT_RECREATE = value;
      expect(() =>
        assertDriftRecreateAllowed(
          logger,
          `Consumer "c" on stream "S" (val=${value})`,
          'filter_subject "a" → "b"',
        ),
      ).toThrow(/NATS_STREAM_DRIFT_RECREATE=true/);
    }
  });

  it('propagates the subject label and drift summary in both paths', () => {
    const subject = 'Consumer "notification-sent" on stream "NOTIFICATION"';
    const drift = 'filter_subject "NOTIFICATION.old" → "NOTIFICATION.new"';

    process.env.NATS_STREAM_DRIFT_RECREATE = 'true';
    assertDriftRecreateAllowed(logger, subject, drift);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(subject);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(drift);

    delete process.env.NATS_STREAM_DRIFT_RECREATE;
    expect(() => assertDriftRecreateAllowed(logger, subject, drift)).toThrow();
    expect(errorSpy.mock.calls[0]?.[0]).toContain(subject);
    expect(errorSpy.mock.calls[0]?.[0]).toContain(drift);
  });
});
