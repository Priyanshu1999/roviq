import { workflow } from '@novu/framework';

/**
 * User welcome workflow — critical (no opt-out).
 *
 * Triggered once when a new user account is created by IdentityService.
 * Delivers the temporary password so the user can complete first login.
 *
 * Channels:
 *  - Email — always (every new user has an email)
 *  - SMS   — only when a phone number was captured at account creation
 *  - In-app — always (visible on first login)
 */

const payloadSchema = {
  type: 'object',
  properties: {
    username: { type: 'string' },
    email: { type: 'string' },
    phone: { type: ['string', 'null'] },
    firstName: { type: ['string', 'null'] },
    lastName: { type: ['string', 'null'] },
    tempPassword: { type: 'string' },
    scope: { type: 'string', enum: ['platform', 'reseller', 'institute'] },
  },
  required: ['username', 'email', 'tempPassword', 'scope'],
  additionalProperties: false,
} as const;

export const userWelcomeWorkflow = workflow(
  'user-welcome',
  async ({ step, payload }) => {
    const displayName = payload.firstName ?? payload.username;
    const subject = 'Welcome to Roviq — your account is ready';
    const body = [
      `Hi ${displayName},`,
      '',
      'Your Roviq account has been set up.',
      `Username: ${payload.username}`,
      `Temporary password: ${payload.tempPassword}`,
      '',
      'Log in and change your password on first sign-in.',
    ].join('\n');

    // Email — always
    await step.email('welcome-email', async () => ({ subject, body }));

    // SMS — only when a phone number was captured at account creation
    await step.sms(
      'welcome-sms',
      async () => ({
        body: `Roviq: Account ready. Username: ${payload.username} | Temp password: ${payload.tempPassword}. Change it on first login.`,
      }),
      { skip: () => !payload.phone },
    );

    // In-app — always
    await step.inApp('welcome-in-app', async () => ({
      subject: 'Welcome to Roviq',
      body: `Your account is ready. Log in with username ${payload.username} and change your password on first sign-in.`,
    }));
  },
  {
    payloadSchema,
    name: 'User Welcome',
    tags: ['system', 'onboarding'],
    preferences: {
      all: { readOnly: true },
      channels: {
        email: { enabled: true },
        sms: { enabled: true },
        inApp: { enabled: true },
      },
    },
  },
);
