import { workflow } from '@novu/framework';

/**
 * System authentication workflow — critical (no user opt-out).
 *
 * Covers password resets, new device logins, email verification, etc.
 * All channels are always delivered; WhatsApp is limited to password-reset
 * and new-device events.
 */

const payloadSchema = {
  type: 'object',
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
    whatsappBody: { type: 'string' },
    pushBody: { type: 'string' },
    eventType: {
      type: 'string',
      enum: [
        'login',
        'password-reset',
        'new-device',
        'email-verification',
        'account-locked',
        'password-changed',
        'impersonation-otp',
      ],
    },
  },
  required: ['subject', 'body', 'eventType'],
  additionalProperties: false,
} as const;

export const systemAuthWorkflow = workflow(
  'system-auth',
  async ({ step, payload }) => {
    // In-app — always delivered
    await step.inApp('system-auth-in-app', async () => ({
      subject: payload.subject,
      body: payload.body,
    }));

    // Email — always delivered
    await step.email('system-auth-email', async () => ({
      subject: payload.subject,
      body: payload.body,
    }));

    // WhatsApp (chat) — only for password-reset and new-device events
    await step.chat(
      'system-auth-whatsapp',
      async () => ({
        body: payload.whatsappBody ?? payload.body,
      }),
      {
        skip: () => payload.eventType !== 'password-reset' && payload.eventType !== 'new-device',
      },
    );

    // Push — always delivered
    await step.push('system-auth-push', async () => ({
      subject: payload.subject,
      body: payload.pushBody ?? payload.body,
    }));
  },
  {
    payloadSchema,
    name: 'System Authentication',
    tags: ['system', 'auth'],
    preferences: {
      all: { readOnly: true },
      channels: {
        inApp: { enabled: true },
        email: { enabled: true },
        chat: { enabled: true },
        push: { enabled: true },
      },
    },
  },
);
