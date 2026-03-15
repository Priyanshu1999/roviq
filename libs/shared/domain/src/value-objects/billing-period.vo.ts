export class BillingPeriod {
  private constructor(
    readonly start: Date,
    readonly end: Date,
  ) {}

  static fromInterval(start: Date, interval: 'MONTHLY' | 'QUARTERLY' | 'YEARLY'): BillingPeriod {
    const end = new Date(start);
    const originalDay = end.getDate();
    switch (interval) {
      case 'MONTHLY':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'QUARTERLY':
        end.setMonth(end.getMonth() + 3);
        break;
      case 'YEARLY':
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
    // Clamp to last day of target month when day overflow occurs
    if (end.getDate() !== originalDay) {
      end.setDate(0);
    }
    return new BillingPeriod(new Date(start), end);
  }

  contains(date: Date): boolean {
    return date >= this.start && date < this.end;
  }
}
