declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: 'development' | 'production' | 'test';
      DATABASE_URL?: string;
      DATABASE_URL_TEST?: string;
      DATABASE_URL_MIGRATE?: string;
      DATABASE_URL_TEST_MIGRATE?: string;
      DATABASE_URL_ADMIN?: string;
      JWT_SECRET?: string;
      JWT_REFRESH_SECRET?: string;
      NATS_URL?: string;
      NATS_STREAM_DRIFT_RECREATE?: string;
      REDIS_URL?: string;
      LOG_LEVEL?: string;
      TEMPORAL_ADDRESS?: string;
      ROVIQ_EE?: string;
      BILLING_ENCRYPTION_KEY?: string;
      RAZORPAY_WEBHOOK_SECRET?: string;
      CASHFREE_WEBHOOK_SECRET?: string;
      DATABASE_URL_E2E?: string;
      CI?: string;
      API_URL?: string;
      WEB_URL?: string;
      WS_URL?: string;
      MAX_LOGIN_ATTEMPTS?: string;
      LOCKOUT_DURATION_SECONDS?: string;
      FAILURE_WINDOW_SECONDS?: string;
      NATS_VALIDATE_PAYLOADS?: string;
    }
  }
}

export {};
