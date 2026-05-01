// NATS subjects for the NOTIFICATION stream.
//
// The canonical definition lives in `@roviq/nats-jetstream`'s
// `EVENT_PATTERNS.NOTIFICATION`; this file re-shapes it as the flat
// `NOTIFICATION_SUBJECTS` map the notification-service listeners and
// api-gateway emitters consume. Single source of truth, so renaming a
// subject can't drift between the registry and the listeners.

import { EVENT_PATTERNS } from '@roviq/nats-jetstream';

export const NOTIFICATION_SUBJECTS = EVENT_PATTERNS.NOTIFICATION;

export type NotificationSubject =
  (typeof NOTIFICATION_SUBJECTS)[keyof typeof NOTIFICATION_SUBJECTS];
