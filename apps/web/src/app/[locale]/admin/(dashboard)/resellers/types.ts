export type ResellerTier = 'FULL_MANAGEMENT' | 'SUPPORT_MANAGEMENT' | 'READ_ONLY';
export type ResellerStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface ResellerBranding {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

/**
 * Platform-admin view of a reseller. Mirrors AdminResellerModel from the backend.
 */
export interface ResellerNode {
  id: string;
  name: string;
  slug: string;
  tier: ResellerTier;
  status: ResellerStatus;
  isSystem: boolean;
  isActive: boolean;
  branding?: ResellerBranding | null;
  customDomain?: string | null;
  suspendedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  instituteCount: number;
  teamSize: number;
}

export interface ResellerEdge {
  cursor: string;
  node: ResellerNode;
}

export interface ResellersConnectionData {
  adminListResellers: {
    edges: ResellerEdge[];
    totalCount: number;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      endCursor: string | null;
      startCursor: string | null;
    };
  };
}

export interface ResellerDetailData {
  adminGetReseller: ResellerNode;
}

export interface CreateResellerData {
  adminCreateReseller: ResellerNode;
}

export interface UpdateResellerData {
  adminUpdateReseller: ResellerNode;
}

export interface ChangeResellerTierData {
  adminChangeResellerTier: ResellerNode;
}

export interface CreateResellerInput {
  name: string;
  slug?: string;
  tier: ResellerTier;
  initialAdminEmail: string;
  customDomain?: string;
  branding?: {
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

export interface UpdateResellerInput {
  name?: string;
  customDomain?: string;
  branding?: {
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}
