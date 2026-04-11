'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';
import type { PaymentGatewayConfigModel } from '@roviq/graphql/generated';

/** Shape of a single gateway config node returned by the GatewayConfigs query. */
type GatewayConfigNode = PaymentGatewayConfigModel;

interface GatewayConfigsQueryData {
  gatewayConfigs: GatewayConfigNode[];
}

const GATEWAY_CONFIGS_QUERY = gql`
  query GatewayConfigs {
    gatewayConfigs {
      id
      resellerId
      provider
      status
      displayName
      isDefault
      testMode
      supportedMethods
      webhookUrl
      upiVpa
      createdAt
      updatedAt
    }
  }
`;

const CREATE_GATEWAY_CONFIG = gql`
  mutation CreateGatewayConfig($input: CreateGatewayConfigInput!) {
    createGatewayConfig(input: $input) {
      id provider status displayName isDefault testMode webhookUrl upiVpa
    }
  }
`;

const UPDATE_GATEWAY_CONFIG = gql`
  mutation UpdateGatewayConfig($id: ID!, $input: UpdateGatewayConfigInput!) {
    updateGatewayConfig(id: $id, input: $input) {
      id provider status displayName isDefault testMode webhookUrl upiVpa
    }
  }
`;

const DELETE_GATEWAY_CONFIG = gql`
  mutation DeleteGatewayConfig($id: ID!) {
    deleteGatewayConfig(id: $id)
  }
`;

export function useGatewayConfigs() {
  const { data, loading, error, refetch } =
    useQuery<GatewayConfigsQueryData>(GATEWAY_CONFIGS_QUERY);
  return {
    configs: data?.gatewayConfigs ?? [],
    loading,
    error,
    refetch,
  };
}

export function useCreateGatewayConfig() {
  return useMutation(CREATE_GATEWAY_CONFIG, { refetchQueries: ['GatewayConfigs'] });
}

export function useUpdateGatewayConfig() {
  return useMutation(UPDATE_GATEWAY_CONFIG, { refetchQueries: ['GatewayConfigs'] });
}

export function useDeleteGatewayConfig() {
  return useMutation(DELETE_GATEWAY_CONFIG, { refetchQueries: ['GatewayConfigs'] });
}
