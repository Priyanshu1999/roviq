// Manual types for admin institute pages (until codegen regeneration)

export interface InstituteNode {
  id: string;
  name: Record<string, string>;
  slug: string;
  code?: string | null;
  type: 'SCHOOL' | 'COACHING' | 'LIBRARY';
  structureFramework: 'NEP' | 'TRADITIONAL';
  setupStatus: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
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
  branding?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  identifiers?: Array<{
    type: string;
    value: string;
    issuedBy?: string;
    validUntil?: string;
  }>;
  affiliations?: Array<{
    board: string;
    affiliationStatus: string;
    affiliationNumber?: string;
    grantedLevel?: string;
    validFrom?: string;
    validTo?: string;
  }>;
  departments?: string[];
  /** Reseller name (resolved by backend) */
  resellerName?: string;
  /** Group name (resolved by backend) */
  groupName?: string | null;
}

export type InstituteStatus =
  | 'PENDING_APPROVAL'
  | 'PENDING'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'REJECTED';

export interface InstituteEdge {
  cursor: string;
  node: InstituteNode;
}

export interface InstitutesConnectionData {
  institutes: {
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
  institute: InstituteNode;
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
