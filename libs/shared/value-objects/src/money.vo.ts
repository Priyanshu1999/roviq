export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static create(amount: number, currency: string): Money {
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error('Amount must be a non-negative integer (minor units)');
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error('Currency must be a 3-letter ISO 4217 code');
    }
    return new Money(amount, currency);
  }

  static tryCreate(amount: number, currency: string): Money | null {
    if (!Number.isInteger(amount) || amount < 0) return null;
    if (!/^[A-Z]{3}$/.test(currency)) return null;
    return new Money(amount, currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  format(locale = 'en-IN'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
    }).format(this.amount / 100);
  }
}
