const LIMIT_KEYS = ['maxUsers', 'maxSections', 'maxStorageGb'] as const;
type LimitKey = (typeof LIMIT_KEYS)[number];
type Limits = Partial<Record<LimitKey, number>>;

const KNOWN_KEYS: ReadonlySet<string> = new Set(LIMIT_KEYS);

function validateLimits(raw: Record<string, unknown>): string | null {
  for (const [key, val] of Object.entries(raw)) {
    if (!KNOWN_KEYS.has(key)) return `Unknown limit key: ${key}`;
    if (val !== undefined && (!Number.isInteger(val) || (val as number) < 0)) {
      return `${key} must be a non-negative integer`;
    }
  }
  return null;
}

export class FeatureLimits {
  private constructor(private readonly _limits: Readonly<Limits>) {}

  static create(raw: Record<string, unknown>): FeatureLimits {
    const error = validateLimits(raw);
    if (error) throw new Error(error);
    return new FeatureLimits({ ...raw } as Limits);
  }

  static tryCreate(raw: Record<string, unknown>): FeatureLimits | null {
    if (validateLimits(raw)) return null;
    return new FeatureLimits({ ...raw } as Limits);
  }

  static empty(): FeatureLimits {
    return new FeatureLimits({});
  }

  get maxUsers(): number | undefined {
    return this._limits.maxUsers;
  }

  get maxSections(): number | undefined {
    return this._limits.maxSections;
  }

  get maxStorageGb(): number | undefined {
    return this._limits.maxStorageGb;
  }

  isWithin(key: LimitKey, currentUsage: number): boolean {
    const limit = this._limits[key];
    return limit === undefined || currentUsage <= limit;
  }

  toJSON(): Limits {
    return { ...this._limits };
  }

  equals(other: FeatureLimits): boolean {
    return LIMIT_KEYS.every((k) => this._limits[k] === other._limits[k]);
  }
}
