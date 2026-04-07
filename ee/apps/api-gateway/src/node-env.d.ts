declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /**
       * When set to `"true"`, billing integration tests run against a real database
       * instead of being skipped.
       */
      BILLING_INTEGRATION?: string;
    }
  }
}

export {};
