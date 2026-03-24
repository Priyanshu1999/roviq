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
  first?: number;
  after?: string;
}

export interface InstituteStatistics {
  totalInstitutes: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
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
