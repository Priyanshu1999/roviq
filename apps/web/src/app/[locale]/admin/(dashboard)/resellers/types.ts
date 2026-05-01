import type {
  AdminCreateResellerInput,
  AdminResellerModel,
  AdminUpdateResellerInput,
  ResellerBrandingModel,
  ResellerStatus,
  ResellerTier,
} from '@roviq/graphql/generated';

export type { ResellerStatus, ResellerTier };
export type ResellerBranding = ResellerBrandingModel;
export type ResellerNode = AdminResellerModel;
export type CreateResellerInput = AdminCreateResellerInput;
export type UpdateResellerInput = AdminUpdateResellerInput;

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
