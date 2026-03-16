# @roviq/ee-payments

Provider-agnostic payment gateway library. Abstracts Razorpay and Cashfree behind a common `PaymentGateway` interface so the billing module never deals with provider-specific APIs directly.

## Usage

```typescript
import { PaymentGatewayFactory } from '@roviq/ee-payments';

// By provider name
const gateway = factory.getForProvider('RAZORPAY');

// By institute (looks up PaymentGatewayConfig in DB)
const gateway = await factory.getForInstitute(instituteId);
```

## PaymentGateway Interface

```typescript
interface PaymentGateway {
  // Plans
  createPlan(params: CreatePlanInput): Promise<ProviderPlan>;
  fetchPlan(providerPlanId: string): Promise<ProviderPlan>;

  // Subscriptions
  createSubscription(params: CreateSubscriptionInput): Promise<ProviderSubscription>;
  fetchSubscription(providerSubscriptionId: string): Promise<ProviderSubscription>;
  cancelSubscription(providerSubscriptionId: string, atCycleEnd?: boolean): Promise<void>;
  pauseSubscription(providerSubscriptionId: string): Promise<void>;
  resumeSubscription(providerSubscriptionId: string): Promise<void>;

  // Payments
  fetchPayments(providerSubscriptionId: string): Promise<ProviderPayment[]>;
  refund(providerPaymentId: string, amount?: number): Promise<ProviderRefund>;

  // Webhooks
  verifyWebhook(headers: Record<string, string>, rawBody: string): ProviderWebhookEvent;
}
```

## Adding a New Provider

1. Create `ee/libs/backend/payments/src/adapters/<provider>.adapter.ts`
2. Implement `PaymentGateway` interface
3. Register in `PaymentGatewayFactory` constructor
4. Add env vars to `.env.example` and `env.validation.ts`
5. Add webhook endpoint in `ee/apps/api-gateway/src/billing/webhook.controller.ts`

## Error Handling

All provider errors are wrapped in `PaymentGatewayError`:

```typescript
class PaymentGatewayError extends Error {
  provider: string;       // 'RAZORPAY' | 'CASHFREE'
  statusCode?: number;    // HTTP status from provider
  providerError?: unknown; // Raw error from provider SDK
}
```
