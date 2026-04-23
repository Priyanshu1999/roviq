import type { Logger } from '@nestjs/common';

/**
 * Env-var gate for destructive stream/consumer recreation.
 *
 * JetStream forbids in-place changes to certain config fields (stream
 * retention/storage, consumer filter_subject). Historically we detected
 * drift on boot and silently did `delete` + `add` — which throws away any
 * un-acked messages currently queued for that stream/consumer. Safe in
 * dev, catastrophic in prod on a rollback/redeploy.
 *
 * This gate forces the operator to opt in explicitly. Default (unset)
 * logs a clear actionable error and throws so the service fails to boot
 * and a human decides how to migrate.
 *
 * Set `NATS_STREAM_DRIFT_RECREATE=true` to permit destructive recreation.
 */
const DRIFT_RECREATE_ENV = 'NATS_STREAM_DRIFT_RECREATE';

function isRecreateAllowed(): boolean {
  return process.env.NATS_STREAM_DRIFT_RECREATE === 'true';
}

/**
 * Asserts destructive recreation is allowed for the given drift. Call
 * this right before `jsm.streams.delete` / `jsm.consumers.delete` whose
 * only purpose is to work around a non-updatable field.
 *
 * @param logger - the caller's logger (we reuse the existing namespace
 *   rather than spinning up a new one so messages stay grouped)
 * @param subject - human label for the thing being recreated, e.g.
 *   `'Stream "NOTIFICATION"'` or `'Consumer "notification-sent" on stream "NOTIFICATION"'`
 * @param driftSummary - short "field X → Y" description used in both
 *   the warn (allowed path) and error (blocked path) messages
 *
 * @throws Error when the env gate is unset/false — message includes the
 *   env var name, the drift summary, and a migration hint
 */
export function assertDriftRecreateAllowed(
  logger: Logger,
  subject: string,
  driftSummary: string,
): void {
  if (isRecreateAllowed()) {
    logger.warn(
      `${subject} drift detected: ${driftSummary}. ` +
        `${DRIFT_RECREATE_ENV}=true — deleting and recreating. ` +
        'Any un-acked messages on this stream/consumer will be dropped.',
    );
    return;
  }

  const message =
    `${subject} drift detected: ${driftSummary}. ` +
    `Set ${DRIFT_RECREATE_ENV}=true to allow destructive recreation ` +
    '(DANGER: drops un-acked messages). Otherwise migrate manually.';
  logger.error(message);
  throw new Error(message);
}
