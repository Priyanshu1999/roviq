export class DateRange {
  private constructor(
    private readonly _start: Date,
    private readonly _end: Date,
  ) {}

  static create(start: Date, end: Date): DateRange {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Invalid date');
    }
    if (start >= end) {
      throw new Error('Start date must be before end date');
    }
    return new DateRange(new Date(start), new Date(end));
  }

  static tryCreate(start: Date, end: Date): DateRange | null {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (start >= end) return null;
    return new DateRange(new Date(start), new Date(end));
  }

  get start(): Date {
    return new Date(this._start);
  }

  get end(): Date {
    return new Date(this._end);
  }

  get durationMs(): number {
    return this._end.getTime() - this._start.getTime();
  }

  get durationDays(): number {
    return Math.ceil(this.durationMs / (1000 * 60 * 60 * 24));
  }

  contains(date: Date): boolean {
    return date >= this._start && date < this._end;
  }

  overlaps(other: DateRange): boolean {
    return this._start < other._end && other._start < this._end;
  }

  equals(other: DateRange): boolean {
    return (
      this._start.getTime() === other._start.getTime() &&
      this._end.getTime() === other._end.getTime()
    );
  }
}
