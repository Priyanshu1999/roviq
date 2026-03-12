import type { NotificationPort, SubscriberData, TriggerPayload } from '../ports/notification.port';

export class MockNotificationAdapter implements NotificationPort {
  readonly triggers: TriggerPayload[] = [];
  readonly subscribers: SubscriberData[] = [];

  async trigger(payload: TriggerPayload): Promise<void> {
    this.triggers.push(payload);
  }

  async identifySubscriber(data: SubscriberData): Promise<void> {
    this.subscribers.push(data);
  }

  reset(): void {
    this.triggers.length = 0;
    this.subscribers.length = 0;
  }
}
