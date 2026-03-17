export class HandlerTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(`Handler timed out after ${timeoutMs}ms`);
    this.name = 'HandlerTimeoutError';
  }
}

export class DeserializationError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'DeserializationError';
  }
}
