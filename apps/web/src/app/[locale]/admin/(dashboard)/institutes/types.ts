import type {
  InstituteConnection,
  InstituteModel,
  InstituteStatus,
  InstituteType,
  SetupStatus,
  StructureFramework,
} from '@roviq/graphql/generated';

export type { InstituteStatus, InstituteType, SetupStatus, StructureFramework };

/**
 * Admin-scoped institute node. Extends the codegen base with admin-only
 * resolver fields (resellerName, groupName, departments, version) that the
 * admin scope appends but which are not in the shared InstituteModel schema type.
 */
export type InstituteNode = InstituteModel & {
  version?: number;
  departments?: string[];
  /** Resolved by admin scope resolver. */
  resellerName?: string;
  groupName?: string | null;
};

export type InstituteEdgeNode = { cursor: string; node: InstituteNode };

export interface InstitutesConnectionData {
  adminListInstitutes: {
    edges: InstituteEdgeNode[];
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

// Re-export InstituteConnection for hooks that type their useQuery generics.
export type { InstituteConnection };
