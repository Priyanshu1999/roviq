export interface TriggerPayload {
  workflowId: string;
  to: {
    subscriberId: string;
    email?: string;
    phone?: string;
  };
  payload: Record<string, unknown>;
  tenantId?: string;
}

export interface SubscriberData {
  subscriberId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  data?: Record<string, unknown>;
}

export interface NotificationPort {
  trigger(payload: TriggerPayload): Promise<void>;
  identifySubscriber(data: SubscriberData): Promise<void>;
}

export const NOTIFICATION_PORT = 'NOTIFICATION_PORT';
