import { workflow } from '@novu/framework';

/**
 * Attendance-absent workflow.
 *
 * Sends an immediate in-app notification, then digests events daily
 * (default 6 PM) and fans out to WhatsApp, email, and push based on
 * the per-notification channel config.
 */

const DEFAULT_DIGEST_CRON = '0 18 * * *'; // Daily at 6 PM

const payloadSchema = {
  type: 'object',
  properties: {
    sessionId: { type: 'string' },
    studentId: { type: 'string' },
    status: { type: 'string', enum: ['ABSENT', 'LATE'] },
    remarks: { type: ['string', 'null'] },
    markedAt: { type: 'string' },
    config: {
      type: 'object',
      properties: {
        whatsapp: { type: 'boolean', default: false },
        email: { type: 'boolean', default: false },
        push: { type: 'boolean', default: false },
      },
      required: ['whatsapp', 'email', 'push'],
      additionalProperties: false,
    },
    digestCron: { type: 'string' },
  },
  required: ['sessionId', 'studentId', 'status', 'markedAt', 'config'],
  additionalProperties: false,
} as const;

export const attendanceAbsentWorkflow = workflow(
  'attendance-absent',
  async ({ step, payload }) => {
    // Immediate in-app notification.
    //
    // The payload is intentionally thin — the producer (api-gateway) emits only
    // ids. Until we wire a projection lookup in the listener, the copy uses the
    // status + timestamp. TODO(attendance): swap `payload.studentId` for the
    // resolved student + section name once the listener enriches.
    const statusWord = payload.status === 'LATE' ? 'late' : 'absent';
    await step.inApp('attendance-absent-in-app', async () => ({
      subject: payload.status === 'LATE' ? 'Late arrival recorded' : 'Absence recorded',
      body: `Your ward was marked ${statusWord} at ${payload.markedAt}. Please contact the institute if this is incorrect.`,
    }));

    // Daily digest — collect events before fanning out
    const digestResult = await step.digest('attendance-absent-digest', async () => ({
      cron: payload.digestCron ?? DEFAULT_DIGEST_CRON,
    }));

    const events = digestResult.events ?? [];
    const totalAbsent = events.length;
    const summary =
      totalAbsent === 1
        ? `Your ward was marked ${statusWord} at ${payload.markedAt}.`
        : `${totalAbsent} attendance alert(s) recorded today.`;

    // WhatsApp — skip if disabled
    await step.chat(
      'attendance-absent-whatsapp',
      async () => ({
        body: summary,
      }),
      {
        skip: () => !payload.config.whatsapp,
      },
    );

    // Email — skip if disabled
    await step.email(
      'attendance-absent-email',
      async () => ({
        subject: `Attendance Alert: ${totalAbsent} absence(s)`,
        body: summary,
      }),
      {
        skip: () => !payload.config.email,
      },
    );

    // Push — skip if disabled
    await step.push(
      'attendance-absent-push',
      async () => ({
        subject: 'Attendance Alert',
        body: summary,
      }),
      {
        skip: () => !payload.config.push,
      },
    );
  },
  {
    payloadSchema,
    name: 'Attendance Absent',
    tags: ['attendance'],
    preferences: {
      channels: {
        inApp: { enabled: true },
        email: { enabled: true },
        chat: { enabled: true },
        push: { enabled: true },
      },
    },
  },
);
