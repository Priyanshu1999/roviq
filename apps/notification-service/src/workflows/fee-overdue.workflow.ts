import { workflow } from '@novu/framework';

/**
 * Fee-overdue workflow.
 *
 * Sends an immediate in-app notification, then digests events weekly
 * (7 days) before fanning out to WhatsApp, email, and push based on
 * the per-notification channel config.
 */

const payloadSchema = {
  type: 'object',
  properties: {
    studentName: { type: 'string' },
    feeType: { type: 'string' },
    amountDue: { type: 'number' },
    currency: { type: 'string', default: 'INR' },
    dueDate: { type: 'string' },
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
  },
  required: ['studentName', 'feeType', 'amountDue', 'dueDate', 'config'],
  additionalProperties: false,
} as const;

export const feeOverdueWorkflow = workflow(
  'fee-overdue',
  async ({ step, payload }) => {
    // Immediate in-app notification
    await step.inApp('fee-overdue-in-app', async () => ({
      subject: 'Fee Overdue',
      body: `${payload.studentName} has an overdue ${payload.feeType} fee of ${payload.currency} ${payload.amountDue} (due ${payload.dueDate}).`,
    }));

    // Weekly digest — aggregate overdue fee events
    const digestResult = await step.digest('fee-overdue-digest', async () => ({
      amount: 7,
      unit: 'days' as const,
    }));

    const events = digestResult.events ?? [];
    const totalOverdue = events.length;
    const summary =
      totalOverdue === 1
        ? `${payload.studentName} has an overdue ${payload.feeType} fee of ${payload.currency} ${payload.amountDue}.`
        : `${totalOverdue} overdue fee reminder(s) this week.`;

    // WhatsApp — skip if disabled
    await step.chat(
      'fee-overdue-whatsapp',
      async () => ({
        body: summary,
      }),
      {
        skip: () => !payload.config.whatsapp,
      },
    );

    // Email — skip if disabled
    await step.email(
      'fee-overdue-email',
      async () => ({
        subject: `Fee Overdue: ${totalOverdue} reminder(s)`,
        body: summary,
      }),
      {
        skip: () => !payload.config.email,
      },
    );

    // Push — skip if disabled
    await step.push(
      'fee-overdue-push',
      async () => ({
        subject: 'Fee Overdue',
        body: summary,
      }),
      {
        skip: () => !payload.config.push,
      },
    );
  },
  {
    payloadSchema,
    name: 'Fee Overdue',
    tags: ['fees'],
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
