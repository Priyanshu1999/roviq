declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: 'development' | 'production' | 'test';
      DATABASE_URL?: string;
      DATABASE_URL_TEST?: string;
      DATABASE_URL_MIGRATE?: string;
      DATABASE_URL_ADMIN?: string;
      JWT_SECRET?: string;
      NATS_URL?: string;
      REDIS_URL?: string;
      ROVIQ_EE?: string;
      BILLING_ENCRYPTION_KEY?: string;
    }
  }
}

export {};
