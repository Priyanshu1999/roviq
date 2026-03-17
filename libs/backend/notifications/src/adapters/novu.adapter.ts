import type { NotificationPort, SubscriberData, TriggerPayload } from '../ports/notification.port';

/**
 * Novu adapter — delegates to @novu/api SDK.
 * Instantiated in notification-service with real API key.
 */
export class NovuAdapter implements NotificationPort {
  constructor(readonly _apiKey: string) {}

  async trigger(_payload: TriggerPayload): Promise<void> {
    // Implemented in notification-service where @novu/api is installed
    throw new Error('NovuAdapter.trigger must be overridden in notification-service');
  }

  async identifySubscriber(_data: SubscriberData): Promise<void> {
    throw new Error('NovuAdapter.identifySubscriber must be overridden in notification-service');
  }
}
