import { NatsContext } from '@nestjs/microservices';

export interface JetStreamMeta {
  stream: string;
  durableName: string;
  deliveryCount: number;
  sequence: { stream: number; consumer: number };
}

export class JetStreamContext extends NatsContext {
  public signal?: AbortSignal;
  private _nakDelay?: number;
  private readonly meta: JetStreamMeta;

  constructor(args: [string, unknown, JetStreamMeta]) {
    super([args[0], args[1]]);
    this.meta = args[2];
  }

  getStream(): string {
    return this.meta.stream;
  }

  getDurableName(): string {
    return this.meta.durableName;
  }

  getDeliveryCount(): number {
    return this.meta.deliveryCount;
  }

  getSequence(): { stream: number; consumer: number } {
    return this.meta.sequence;
  }

  getCorrelationId(): string {
    const headers = this.getHeaders();
    return headers?.get?.('correlation-id') ?? '';
  }

  getTenantId(): string | undefined {
    const headers = this.getHeaders();
    const value = headers?.get?.('tenant-id');
    return value || undefined;
  }

  setNakDelay(ms: number): void {
    this._nakDelay = ms;
  }

  getNakDelay(): number | undefined {
    return this._nakDelay;
  }
}
