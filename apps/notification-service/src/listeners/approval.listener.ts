import type { NatsConnection } from '@nats-io/nats-core';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type MessageMeta, subscribe } from '@roviq/nats-utils';
import {
  type ApprovalRequestedEvent,
  type ApprovalResolvedEvent,
  NOTIFICATION_SUBJECTS,
} from '@roviq/notifications';
import { tenantContext } from '@roviq/prisma-client';
import { NATS_CONNECTION } from '../nats/nats.provider';
import { NotificationTriggerService } from '../services/notification-trigger.service';
import { PreferenceLoaderService } from '../services/preference-loader.service';

@Injectable()
export class ApprovalListener implements OnModuleInit {
  private readonly logger = new Logger(ApprovalListener.name);

  constructor(
    @Inject(NATS_CONNECTION) private readonly nc: NatsConnection,
    private readonly triggerService: NotificationTriggerService,
    private readonly preferenceLoader: PreferenceLoaderService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Subscribing to approval notification events');

    void subscribe<ApprovalRequestedEvent>(
      this.nc,
      {
        stream: 'NOTIFICATION',
        subject: NOTIFICATION_SUBJECTS.APPROVAL_REQUESTED,
        durableName: 'notification-approval',
      },
      (payload, meta) => this.handleRequested(payload, meta),
    );

    void subscribe<ApprovalResolvedEvent>(
      this.nc,
      {
        stream: 'NOTIFICATION',
        subject: NOTIFICATION_SUBJECTS.APPROVAL_RESOLVED,
        durableName: 'notification-approval',
      },
      (payload, meta) => this.handleResolved(payload, meta),
    );
  }

  private async handleRequested(event: ApprovalRequestedEvent, _meta: MessageMeta): Promise<void> {
    this.logger.log(
      `Processing approval requested by "${event.requesterName}" for "${event.approverName}" ` +
        `in tenant "${event.tenantId}"`,
    );

    await tenantContext.run({ tenantId: event.tenantId }, async () => {
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
    });
  }

  private async handleResolved(event: ApprovalResolvedEvent, _meta: MessageMeta): Promise<void> {
    this.logger.log(
      `Processing approval ${event.status} by "${event.reviewerName}" ` +
        `for "${event.requesterName}" in tenant "${event.tenantId}"`,
    );

    await tenantContext.run({ tenantId: event.tenantId }, async () => {
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
    });
  }
}
