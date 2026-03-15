const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class EmailAddress {
  private constructor(readonly value: string) {}

  static create(raw: string): EmailAddress {
    const normalised = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(normalised)) {
      throw new Error('Invalid email address');
    }
    return new EmailAddress(normalised);
  }

  static tryCreate(raw: string): EmailAddress | null {
    const normalised = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(normalised)) return null;
    return new EmailAddress(normalised);
  }

  get domain(): string {
    return this.value.split('@')[1];
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
