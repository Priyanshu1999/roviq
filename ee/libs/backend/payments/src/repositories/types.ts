export interface PaymentGatewayConfigRecord {
  provider: string;
  /** AES-256-GCM encrypted credentials blob (iv:tag:ciphertext) */
  credentials?: unknown;
}
