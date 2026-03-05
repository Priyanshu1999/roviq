import CircuitBreaker from 'opossum';

export interface CircuitBreakerOptions {
  name: string;
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  fallback?: (...args: unknown[]) => unknown;
}

const DEFAULT_OPTIONS = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
};

const breakers = new Map<string, CircuitBreaker>();

export function createCircuitBreaker<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: CircuitBreakerOptions,
): CircuitBreaker<TArgs, TResult> {
  const existing = breakers.get(options.name);
  if (existing) {
    return existing as CircuitBreaker<TArgs, TResult>;
  }

  const breaker = new CircuitBreaker(fn, {
    timeout: options.timeout ?? DEFAULT_OPTIONS.timeout,
    errorThresholdPercentage:
      options.errorThresholdPercentage ?? DEFAULT_OPTIONS.errorThresholdPercentage,
    resetTimeout: options.resetTimeout ?? DEFAULT_OPTIONS.resetTimeout,
    name: options.name,
  });

  if (options.fallback) {
    breaker.fallback(options.fallback);
  }

  breakers.set(options.name, breaker);
  return breaker;
}

export function getCircuitBreaker(name: string): CircuitBreaker | undefined {
  return breakers.get(name);
}

export function getAllCircuitBreakers(): Map<string, CircuitBreaker> {
  return breakers;
}

export function removeCircuitBreaker(name: string): boolean {
  const breaker = breakers.get(name);
  if (breaker) {
    breaker.shutdown();
    breakers.delete(name);
    return true;
  }
  return false;
}

export function clearAllCircuitBreakers(): void {
  for (const breaker of breakers.values()) {
    breaker.shutdown();
  }
  breakers.clear();
}
