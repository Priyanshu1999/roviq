import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, NatsContext, Payload } from '@nestjs/microservices';
import { BillingReadRepository } from '../repositories/billing-read.repository';
import type { SubscriptionDetails } from '../repositories/types';
import { NotificationTriggerService } from '../services/notification-trigger.service';

interface SubscriptionEventPayload {
  subscriptionId: string;
  instituteId: string;
}

interface WebhookEventPayload {
  eventType: string;
  providerEventId: string;
  subscriptionId?: string;
  instituteId?: string;
  provider: string;
}

@Controller()
export class BillingNotificationController {
  private readonly logger = new Logger(BillingNotificationController.name);

  constructor(
    private readonly billingRepo: BillingReadRepository,
    private readonly triggerService: NotificationTriggerService,
  ) {}

  @EventPattern('billing.subscription.*')
  @EventPattern('billing.webhook.*')
  async handleBillingEvent(
    @Payload() data: SubscriptionEventPayload & WebhookEventPayload,
    @Ctx() ctx: NatsContext,
  ): Promise<void> {
    const subject = ctx.getSubject();
    this.logger.log(`Received billing event on subject "${subject}"`);

    if (subject.startsWith('billing.subscription.')) {
      await this.handleSubscriptionEvent(subject, data);
    } else if (subject.startsWith('billing.webhook.')) {
      await this.handleWebhookEvent(data);
    }
  }

  private async handleSubscriptionEvent(
    subject: string,
    data: SubscriptionEventPayload,
  ): Promise<void> {
    if (!data.subscriptionId) return;

    const details = await this.billingRepo.findSubscriptionDetails(data.subscriptionId);
    if (!details) return;

    const suffix = subject.split('.').pop() ?? '';
    const { notificationSubject, body } = this.composeSubscriptionMessage(suffix, details);
    if (!notificationSubject) return;

    const ownerUserId = await this.findInstituteOwnerUserId(details.instituteId);
    await this.triggerForRecipients({ notificationSubject, body, suffix }, ownerUserId, null);
  }

  private async handleWebhookEvent(data: WebhookEventPayload): Promise<void> {
    if (!data.subscriptionId || !data.eventType) return;

    const details = await this.billingRepo.findSubscriptionDetails(data.subscriptionId);
    if (!details) return;

    const eventType = data.eventType.toLowerCase();
    const { notificationSubject, body } = this.composeWebhookMessage(eventType, details);
    if (!notificationSubject) return;

    const [ownerUserId, platformAdminUser] = await Promise.all([
      this.findInstituteOwnerUserId(details.instituteId),
      this.billingRepo.findPlatformAdminUser(),
    ]);

    await this.triggerForRecipients(
      { notificationSubject, body, suffix: eventType },
      ownerUserId,
      platformAdminUser?.id ?? null,
    );
  }

  private composeSubscriptionMessage(
    suffix: string,
    details: SubscriptionDetails,
  ): { notificationSubject: string; body: string } {
    const { planName, planAmount } = details;

    switch (suffix) {
      case 'created':
        return planAmount === 0
          ? {
              notificationSubject: 'Subscription activated',
              body: `Your subscription to ${planName} is now active.`,
            }
          : {
              notificationSubject: 'Subscription pending payment',
              body: `A subscription to ${planName} has been created — complete payment to activate.`,
            };
      case 'canceled':
        return {
          notificationSubject: 'Subscription canceled',
          body: `Your ${planName} subscription has been canceled.`,
        };
      case 'paused':
        return {
          notificationSubject: 'Subscription paused',
          body: `Your ${planName} subscription has been paused.`,
        };
      case 'resumed':
        return {
          notificationSubject: 'Subscription resumed',
          body: `Your ${planName} subscription has been resumed.`,
        };
      default:
        return { notificationSubject: '', body: '' };
    }
  }

  private composeWebhookMessage(
    eventType: string,
    details: SubscriptionDetails,
  ): { notificationSubject: string; body: string } {
    const { planName, planAmount, planCurrency } = details;

    switch (eventType) {
      case 'subscription.activated':
        return {
          notificationSubject: 'Subscription activated',
          body: `Your subscription to ${planName} is now active.`,
        };
      case 'subscription.charged':
      case 'payment.captured':
        return {
          notificationSubject: 'Payment received',
          body: `Payment of ${planAmount} ${planCurrency} received for ${planName}.`,
        };
      case 'subscription.halted':
        return {
          notificationSubject: 'Payment failed',
          body: `Payment failed for ${planName} — please update your payment method.`,
        };
      case 'subscription.cancelled':
        return {
          notificationSubject: 'Subscription canceled',
          body: `Your ${planName} subscription has been canceled.`,
        };
      case 'subscription.completed':
        return {
          notificationSubject: 'Subscription ended',
          body: `Your ${planName} subscription period has ended.`,
        };
      default:
        return { notificationSubject: '', body: '' };
    }
  }

  private async triggerForRecipients(
    message: { notificationSubject: string; body: string; suffix: string },
    ownerUserId: string | null,
    platformAdminUserId: string | null,
  ): Promise<void> {
    const eventType = message.suffix.replace(/\./g, '-');

    if (ownerUserId) {
      await this.triggerService.trigger({
        workflowId: 'billing-event',
        to: { subscriberId: ownerUserId },
        payload: {
          subject: message.notificationSubject,
          body: message.body,
          eventType,
        },
      });
    }

    if (platformAdminUserId) {
      await this.triggerService.trigger({
        workflowId: 'billing-event',
        to: { subscriberId: platformAdminUserId },
        payload: {
          subject: message.notificationSubject,
          body: message.body,
          eventType,
        },
      });
    }
  }

  /**
   * Placeholder — will be implemented after the institute module.
   * Will send notifications to billing contacts in the future.
   */
  private async findInstituteOwnerUserId(_instituteId: string): Promise<string | null> {
    // TODO: Query membership with institute_admin role for this institute
    return null;
  }
}
