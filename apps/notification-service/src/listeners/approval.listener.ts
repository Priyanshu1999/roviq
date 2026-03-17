import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload } from '@nestjs/microservices';
import { JetStreamContext } from '@roviq/nats-jetstream';
import {
  type ApprovalRequestedEvent,
  type ApprovalResolvedEvent,
  NOTIFICATION_SUBJECTS,
} from '@roviq/notifications';
import { NotificationTriggerService } from '../services/notification-trigger.service';
import { PreferenceLoaderService } from '../services/preference-loader.service';

@Controller()
export class ApprovalListener {
  private readonly logger = new Logger(ApprovalListener.name);

  constructor(
    private readonly triggerService: NotificationTriggerService,
    private readonly preferenceLoader: PreferenceLoaderService,
  ) {}

  @EventPattern('NOTIFICATION.approval.*', {
    stream: 'NOTIFICATION',
    durable: 'notification-approval',
  })
  async handleApprovalEvent(
    @Payload() event: ApprovalRequestedEvent & ApprovalResolvedEvent,
    @Ctx() ctx: JetStreamContext,
  ): Promise<void> {
    const subject = ctx.getSubject();
    this.logger.log(`Received approval event on subject "${subject}"`);

    if (subject === NOTIFICATION_SUBJECTS.APPROVAL_REQUESTED) {
      await this.handleRequested(event as ApprovalRequestedEvent);
    } else if (subject === NOTIFICATION_SUBJECTS.APPROVAL_RESOLVED) {
      await this.handleResolved(event as ApprovalResolvedEvent);
    }
  }

  private async handleRequested(event: ApprovalRequestedEvent): Promise<void> {
    this.logger.log(
      `Processing approval requested by "${event.requesterName}" for "${event.approverName}" ` +
        `in tenant "${event.tenantId}"`,
    );

    const config = await this.preferenceLoader.loadConfig(event.tenantId, 'APPROVAL');

    await this.triggerService.trigger({
      workflowId: 'approval-request',
      to: { subscriberId: event.approverId },
      payload: {
        requesterName: event.requesterName,
        approverName: event.approverName,
        approvalType: event.approvalType,
        entityId: event.entityId,
        summary: event.summary,
        config: {
          inApp: config.inApp,
          whatsapp: config.whatsapp,
          email: config.email,
          push: config.push,
        },
      },
      tenantId: event.tenantId,
    });
  }

  private async handleResolved(event: ApprovalResolvedEvent): Promise<void> {
    this.logger.log(
      `Processing approval ${event.status} by "${event.reviewerName}" ` +
        `for "${event.requesterName}" in tenant "${event.tenantId}"`,
    );

    const config = await this.preferenceLoader.loadConfig(event.tenantId, 'APPROVAL');

    await this.triggerService.trigger({
      workflowId: 'approval-request',
      to: { subscriberId: event.requesterId },
      payload: {
        requesterName: event.requesterName,
        reviewerName: event.reviewerName,
        approvalType: event.approvalType,
        status: event.status,
        remarks: event.remarks,
        config: {
          inApp: config.inApp,
          whatsapp: config.whatsapp,
          email: config.email,
          push: config.push,
        },
      },
      tenantId: event.tenantId,
    });
  }
}
