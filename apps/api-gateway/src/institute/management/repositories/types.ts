import type {
  InstituteAddress,
  InstituteContact,
  InstituteStatus,
  SectionStrengthNorms,
  ShiftConfig,
  TermConfig,
} from '@roviq/database';

export interface InstituteRecord {
  id: string;
  name: Record<string, string>;
  slug: string;
  code: string | null;
  type: string;
  structureFramework: string;
  setupStatus: string;
  contact: InstituteContact;
  address: InstituteAddress | null;
  logoUrl: string | null;
  timezone: string;
  currency: string;
  settings: Record<string, unknown>;
  status: InstituteStatus;
  resellerId: string;
  groupId: string | null;
  /** Education levels offered — null/empty for non-school types. */
  departments: string[];
  /** True for demo/sandbox institutes — disables notifications, seeds sample data. */
  isDemo: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInstituteData {
  name: Record<string, string>;
  slug: string;
  code?: string;
  type?: string;
  structureFramework?: string;
  contact?: InstituteContact;
  address?: InstituteAddress;
  departments?: string[];
  resellerId?: string;
  groupId?: string;
  isDemo?: boolean;
}

export interface InstituteSearchParams {
  search?: string;
  status?: string;
  /** Filter by multiple statuses (OR). Takes precedence over `status` if both provided. */
  statuses?: string[];
  type?: string;
  /** Filter by reseller (admin-scope listing). */
  resellerId?: string;
  /** Filter by institute group (admin-scope listing). */
  groupId?: string;
  /** Match on institute address state (case-insensitive exact match). */
  state?: string;
  /** Match on institute address district (case-insensitive exact match). */
  district?: string;
  /** Filter by institute affiliation board (e.g. 'cbse') — joins institute_affiliations. */
  affiliationBoard?: string;
  /** Institutes created on or after this date. */
  createdAfter?: Date;
  /** Institutes created on or before this date. */
  createdBefore?: Date;
  first?: number;
  after?: string;
}

export interface KeyCount {
  key: string;
  count: number;
}

export interface InstituteStatistics {
  totalInstitutes: number;
  byStatus: KeyCount[];
  byType: KeyCount[];
  byReseller: Array<{ resellerId: string; count: number }>;
  recentlyCreated: number;
}

export interface UpdateInstituteInfoData {
  name?: Record<string, string>;
  code?: string;
  contact?: InstituteContact;
  address?: InstituteAddress;
  timezone?: string;
  currency?: string;
  version: number;
}

export interface UpdateInstituteBrandingData {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  themeIdentifier?: string;
  coverImageUrl?: string;
}

export interface UpdateInstituteConfigData {
  attendanceType?: string;
  openingTime?: string;
  closingTime?: string;
  shifts?: ShiftConfig[];
  notificationPreferences?: Record<string, unknown>;
  payrollConfig?: Record<string, unknown>;
  gradingSystem?: Record<string, unknown>;
  termStructure?: TermConfig[];
  sectionStrengthNorms?: SectionStrengthNorms;
}

/** Platform-admin only: change reseller/group ownership of an institute. */
export interface UpdateInstituteOwnershipData {
  /** New reseller id — if provided, must reference an existing active reseller. */
  resellerId?: string;
  /** New institute-group id — pass `null` to explicitly remove the group assignment. */
  groupId?: string | null;
}
