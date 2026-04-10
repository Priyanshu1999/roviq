// Manual types for admin institute pages
import type {
  InstituteStatus,
  InstituteType,
  SetupStatus,
  StructureFramework,
} from '@roviq/graphql/generated';

export type { InstituteStatus };

export interface InstituteNode {
  id: string;
  name: Record<string, string>;
  slug: string;
  code?: string | null;
  type: InstituteType;
  structureFramework: StructureFramework;
  setupStatus: SetupStatus;
  contact: {
    phones: Array<{
      country_code: string;
      number: string;
      is_primary: boolean;
      is_whatsapp_enabled: boolean;
      label: string;
    }>;
    emails: Array<{
      address: string;
      is_primary: boolean;
      label: string;
    }>;
  };
  address?: {
    line1: string;
    line2?: string;
    line3?: string;
    city: string;
    district: string;
    state: string;
    postal_code: string;
    country?: string;
    coordinates?: { lat: number; lng: number };
  } | null;
  logoUrl?: string | null;
  timezone: string;
  currency: string;
  settings: Record<string, unknown>;
  status: InstituteStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  branding?: {
    id: string;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    themeIdentifier?: string | null;
    coverImageUrl?: string | null;
  } | null;
  config?: {
    id: string;
    attendanceType?: string | null;
    openingTime?: string | null;
    closingTime?: string | null;
    shifts?: Array<{ name: string; start: string; end: string }> | null;
    notificationPreferences?: Record<string, unknown> | null;
    payrollConfig?: Record<string, unknown> | null;
    gradingSystem?: Record<string, unknown> | null;
    termStructure?: Array<{ label: string; startDate: string; endDate: string }> | null;
    sectionStrengthNorms?: { optimal: number; hardMax: number; exemptionAllowed: boolean } | null;
    admissionNumberConfig?: {
      format: string;
      yearFormat: string;
      prefixes: Record<string, string>;
      noPrefixFromClass: number;
    } | null;
  } | null;
  identifiers?: Array<{
    id: string;
    type: string;
    value: string;
    issuingAuthority?: string | null;
    validFrom?: string | null;
    validTo?: string | null;
  }>;
  affiliations?: Array<{
    id: string;
    board: string;
    affiliationStatus: string;
    affiliationNumber?: string | null;
    grantedLevel?: string | null;
    validFrom: string;
    validTo: string;
    nocNumber?: string | null;
    nocDate?: string | null;
  }>;
  departments?: string[];
  /** Reseller name (resolved by backend) */
  resellerName?: string;
  /** Group name (resolved by backend) */
  groupName?: string | null;
}

export interface InstituteEdge {
  cursor: string;
  node: InstituteNode;
}

export interface InstitutesConnectionData {
  adminListInstitutes: {
    edges: InstituteEdge[];
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      endCursor: string | null;
      startCursor: string | null;
    };
  };
}

export interface InstituteDetailData {
  adminGetInstitute: InstituteNode;
}

export interface CreateInstituteData {
  createInstitute: InstituteNode;
}

/** Setup progress subscription payload */
export interface SetupProgressPayload {
  instituteSetupProgress: {
    instituteId: string;
    phase: string;
    step: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    message?: string;
    completedSteps: number;
    totalSteps: number;
  };
}
