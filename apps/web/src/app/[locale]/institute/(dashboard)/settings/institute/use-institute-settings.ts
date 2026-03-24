import { gql, useMutation, useQuery, useSubscription } from '@roviq/graphql';
import type {
  InstituteBrandingUpdatedData,
  InstituteConfigUpdatedData,
  MyInstituteData,
  UpdateInstituteBrandingData,
  UpdateInstituteConfigData,
  UpdateInstituteInfoData,
} from './types';

// ─── Fragment ────────────────────────────────────────────────────────────────

const INSTITUTE_FIELDS = gql`
  fragment InstituteFields on InstituteModel {
    id
    name
    slug
    code
    type
    structureFramework
    setupStatus
    contact
    address
    logoUrl
    timezone
    currency
    settings
    status
    version
    createdAt
    updatedAt
    branding
    config
    identifiers
    affiliations
    departments
  }
`;

// ─── Query ───────────────────────────────────────────────────────────────────

const MY_INSTITUTE_QUERY = gql`
  query MyInstituteSettings {
    myInstitute {
      ...InstituteFields
    }
  }
  ${INSTITUTE_FIELDS}
`;

export function useMyInstitute() {
  return useQuery<MyInstituteData>(MY_INSTITUTE_QUERY, {
    fetchPolicy: 'cache-and-network',
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

const UPDATE_INSTITUTE_INFO = gql`
  mutation UpdateInstituteInfo($id: ID!, $input: UpdateInstituteInfoInput!) {
    updateInstituteInfo(id: $id, input: $input) {
      ...InstituteFields
    }
  }
  ${INSTITUTE_FIELDS}
`;

const UPDATE_INSTITUTE_BRANDING = gql`
  mutation UpdateInstituteBranding($input: UpdateInstituteBrandingInput!) {
    updateInstituteBranding(input: $input) {
      ...InstituteFields
    }
  }
  ${INSTITUTE_FIELDS}
`;

const UPDATE_INSTITUTE_CONFIG = gql`
  mutation UpdateInstituteConfig($input: UpdateInstituteConfigInput!) {
    updateInstituteConfig(input: $input) {
      ...InstituteFields
    }
  }
  ${INSTITUTE_FIELDS}
`;

export function useUpdateInstituteInfo() {
  return useMutation<UpdateInstituteInfoData, { id: string; input: Record<string, unknown> }>(
    UPDATE_INSTITUTE_INFO,
  );
}

export function useUpdateInstituteBranding() {
  return useMutation<UpdateInstituteBrandingData, { input: Record<string, unknown> }>(
    UPDATE_INSTITUTE_BRANDING,
  );
}

export function useUpdateInstituteConfig() {
  return useMutation<UpdateInstituteConfigData, { input: Record<string, unknown> }>(
    UPDATE_INSTITUTE_CONFIG,
  );
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

const INSTITUTE_BRANDING_UPDATED = gql`
  subscription InstituteBrandingUpdated {
    instituteBrandingUpdated {
      ...InstituteFields
    }
  }
  ${INSTITUTE_FIELDS}
`;

const INSTITUTE_CONFIG_UPDATED = gql`
  subscription InstituteConfigUpdated {
    instituteConfigUpdated {
      ...InstituteFields
    }
  }
  ${INSTITUTE_FIELDS}
`;

export function useInstituteBrandingSubscription() {
  return useSubscription<InstituteBrandingUpdatedData>(INSTITUTE_BRANDING_UPDATED);
}

export function useInstituteConfigSubscription() {
  return useSubscription<InstituteConfigUpdatedData>(INSTITUTE_CONFIG_UPDATED);
}
