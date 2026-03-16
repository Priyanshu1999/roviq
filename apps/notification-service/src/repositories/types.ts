export interface NotificationConfigRecord {
  inAppEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  digestEnabled: boolean;
  digestCron: string | null;
}

export interface SubscriptionDetails {
  subscriptionId: string;
  instituteId: string;
  instituteName: string;
  planName: string;
  planAmount: number;
  planCurrency: string;
}

export interface UserIdRecord {
  id: string;
}
