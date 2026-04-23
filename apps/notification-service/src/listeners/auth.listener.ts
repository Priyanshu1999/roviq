import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { JetStreamContext } from '@roviq/nats-jetstream';
import { type AuthSecurityEvent, NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { NotificationTriggerService } from '../services/notification-trigger.service';

@Controller()
export class AuthListener {
  private readonly logger = new Logger(AuthListener.name);

  constructor(private readonly triggerService: NotificationTriggerService) {}

  @EventPattern(NOTIFICATION_SUBJECTS.AUTH_SECURITY, {
    stream: 'NOTIFICATION',
    durable: 'notification-auth',
  })
  async handleSecurity(
    @Payload() event: AuthSecurityEvent,
    @Ctx() _ctx: JetStreamContext,
  ): Promise<void> {
    this.logger.log(
      `Processing auth security event "${event.eventType}" for user "${event.userId}"`,
    );

    const { subject, body } = this.composeMessage(event);

    await this.triggerService.trigger({
      workflowId: 'system-auth',
      to: { subscriberId: event.userId },
      payload: {
        subject,
        body,
        eventType: event.eventType.toLowerCase().replace(/_/g, '-'),
      },
      tenantId: event.tenantId ?? undefined,
    });
  }

  private composeMessage(event: AuthSecurityEvent): { subject: string; body: string } {
    const ip = (event.metadata.ip as string) ?? 'unknown';
    const time = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

    switch (event.eventType) {
      case 'LOGIN':
        return {
          subject: 'New sign-in to your account',
          body: `A new sign-in was detected from IP ${ip} at ${time}. If this wasn't you, secure your account immediately.`,
        };
      case 'PASSWORD_RESET':
        return {
          subject: 'Password reset requested',
          body: `A password reset was requested for your account at ${time}. If this wasn't you, contact support.`,
        };
      case 'NEW_DEVICE':
        return {
          subject: 'New device sign-in',
          body: `Your account was accessed from a new device at ${time} (IP: ${ip}). If this wasn't you, secure your account.`,
        };
      case 'ACCOUNT_LOCKED':
        return {
          subject: 'Account locked',
          body: `Your account has been locked due to too many failed attempts at ${time}. Contact support to unlock.`,
        };
      case 'SESSION_REVOKED':
        return {
          subject: 'Session revoked',
          body: `A session was revoked for your account at ${time}. If this wasn't you, change your password immediately.`,
        };
      case 'IMPERSONATION_OTP':
        return {
          subject: 'Approve impersonation request',
          body: `Roviq: an admin requested impersonation access to your institute. Approve by entering OTP ${event.metadata.otp} in the admin portal. Code expires in 5 minutes. If you didn't expect this, ignore — the request will time out.`,
        };
      default: {
        const _exhaustive: never = event.eventType;
        return {
          subject: 'Security alert',
          body: `A security event occurred on your account at ${time}.`,
        };
      }
    }
  }
}
