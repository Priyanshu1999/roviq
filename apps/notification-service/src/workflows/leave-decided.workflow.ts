import { workflow } from '@novu/framework';

/**
 * Leave-decided workflow.
 *
 * Triggered by the `NOTIFICATION.leave.decided` NATS event emitted by
 * api-gateway's LeaveService on approve/reject. Delivers in-app + email
 * to the applicant. Payload mirrors the emitted event body:
 *   { tenantId, leaveId, userId, status }
 */

const payloadSchema = {
  type: 'object',
  properties: {
    tenantId: { type: 'string' },
    leaveId: { type: 'string' },
    userId: { type: 'string' },
    status: { type: 'string', enum: ['APPROVED', 'REJECTED'] },
  },
  required: ['tenantId', 'leaveId', 'userId', 'status'],
  additionalProperties: false,
} as const;

export const leaveDecidedWorkflow = workflow(
  'leave-decided',
  async ({ step, payload }) => {
    const statusLower = payload.status.toLowerCase();
    const subject = `Your leave was ${statusLower}`;
    const body = `Your leave application (${payload.leaveId}) has been ${statusLower}.`;

    await step.inApp('leave-decided-in-app', async () => ({
      subject,
      body,
    }));

    await step.email('leave-decided-email', async () => ({
      subject,
      body,
    }));
  },
  {
    payloadSchema,
    name: 'Leave Decided',
    tags: ['leave'],
    preferences: {
      channels: {
        inApp: { enabled: true },
        email: { enabled: true },
      },
    },
  },
);
