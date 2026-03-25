'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';
import type {
  CreateSubscriptionPlanMutation,
  CreateSubscriptionPlanMutationVariables,
  SubscriptionPlansQuery,
  UpdateSubscriptionPlanMutation,
  UpdateSubscriptionPlanMutationVariables,
} from './use-plans.generated';

export type SubscriptionPlanNode = SubscriptionPlansQuery['subscriptionPlans'][number];

const SUBSCRIPTION_PLANS_QUERY = gql`
  query SubscriptionPlans {
    subscriptionPlans {
      id
      name
      description
      amount
      currency
      interval
      trialDays
      sortOrder
      entitlements
      status
      subscriberCount
      createdAt
      updatedAt
    }
  }
`;

const CREATE_PLAN_MUTATION = gql`
  mutation CreateSubscriptionPlan($input: CreatePlanInput!) {
    createSubscriptionPlan(input: $input) {
      id
      name
      description
      amount
      currency
      interval
      trialDays
      sortOrder
      entitlements
      status
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_PLAN_MUTATION = gql`
  mutation UpdateSubscriptionPlan($id: ID!, $input: UpdatePlanInput!) {
    updateSubscriptionPlan(id: $id, input: $input) {
      id
      name
      description
      amount
      currency
      interval
      trialDays
      sortOrder
      entitlements
      status
      createdAt
      updatedAt
    }
  }
`;

export function useSubscriptionPlans() {
  const { data, loading, error, refetch } =
    useQuery<SubscriptionPlansQuery>(SUBSCRIPTION_PLANS_QUERY);

  return {
    plans: data?.subscriptionPlans ?? ([] as SubscriptionPlanNode[]),
    loading,
    error,
    refetch,
  };
}

export function useCreatePlan() {
  return useMutation<CreateSubscriptionPlanMutation, CreateSubscriptionPlanMutationVariables>(
    CREATE_PLAN_MUTATION,
    { refetchQueries: ['SubscriptionPlans'] },
  );
}

export function useUpdatePlan() {
  return useMutation<UpdateSubscriptionPlanMutation, UpdateSubscriptionPlanMutationVariables>(
    UPDATE_PLAN_MUTATION,
    { refetchQueries: ['SubscriptionPlans'] },
  );
}

const ARCHIVE_PLAN_MUTATION = gql`
  mutation ArchivePlan($id: ID!) { archivePlan(id: $id) { id status } }
`;
const RESTORE_PLAN_MUTATION = gql`
  mutation RestorePlan($id: ID!) { restorePlan(id: $id) { id status } }
`;
const DELETE_PLAN_MUTATION = gql`
  mutation DeletePlan($id: ID!) { deletePlan(id: $id) }
`;

export function useArchivePlan() {
  return useMutation(ARCHIVE_PLAN_MUTATION, { refetchQueries: ['SubscriptionPlans'] });
}
export function useRestorePlan() {
  return useMutation(RESTORE_PLAN_MUTATION, { refetchQueries: ['SubscriptionPlans'] });
}
export function useDeletePlan() {
  return useMutation(DELETE_PLAN_MUTATION, { refetchQueries: ['SubscriptionPlans'] });
}
