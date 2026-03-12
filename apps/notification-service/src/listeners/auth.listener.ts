import type { NatsConnection } from '@nats-io/nats-core';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type MessageMeta, subscribe } from '@roviq/nats-utils';
import { type AuthSecurityEvent, NOTIFICATION_SUBJECTS } from '@roviq/notifications';
import { NATS_CONNECTION } from '../nats/nats.provider';
import { NotificationTriggerService } from '../services/notification-trigger.service';

@Injectable()
export class AuthListener implements OnModuleInit {
  private readonly logger = new Logger(AuthListener.name);

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    private readonly triggerService: NotificationTriggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Subscribing to auth security notification events');

    void subscribe<AuthSecurityEvent>(
      this.nc,
      {
        stream: 'NOTIFICATION',
        subject: NOTIFICATION_SUBJECTS.AUTH_SECURITY,
        durableName: 'notification-auth',
      },
      (payload, meta) => this.handleSecurity(payload, meta),
    );
  }

  /**
   * Auth security notifications are system-critical — no opt-out, no preference check.
   * Always delivered on all channels.
   */
  private async handleSecurity(event: AuthSecurityEvent, _meta: MessageMeta): Promise<void> {
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
