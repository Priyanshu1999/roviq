'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';

/**
 * Subscription node shape returned by the subscriptions query.
 * Defined inline since the API returns a plain array (not a connection type).
 */
export interface SubscriptionNode {
  id: string;
  institute?: { id: string; name: Record<string, string> } | null;
  plan?: {
    id: string;
    name: Record<string, string>;
    amount: string;
    currency: string;
    interval: string;
  } | null;
  status: string;
  gatewaySubscriptionId?: string | null;
  gatewayProvider?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelledAt?: string | null;
  trialEndsAt?: string | null;
  createdAt: string;
}

interface SubscriptionsQueryData {
  subscriptions: SubscriptionNode[];
}

interface SubscriptionsQueryVariables {
  status?: string | null;
  first?: number;
  after?: string;
}

/**
 * Resolver returns `[SubscriptionModel]` — a plain array, not a connection.
 * Args: status (optional filter), first (page size), after (cursor).
 */
const SUBSCRIPTIONS_QUERY = gql`
  query Subscriptions($status: String, $first: Int, $after: String) {
    subscriptions(status: $status, first: $first, after: $after) {
      id
      institute {
        id
        name
      }
      plan {
        id
        name
        amount
        currency
        interval
      }
      status
      gatewaySubscriptionId
      gatewayProvider
      currentPeriodStart
      currentPeriodEnd
      cancelledAt
      trialEndsAt
      createdAt
    }
  }
`;

/**
 * Resolver takes two separate ID args: tenantId and planId.
 * Returns SubscriptionModel (not a wrapper with checkoutUrl).
 */
const ASSIGN_PLAN_MUTATION = gql`
  mutation AssignPlanToInstitute($tenantId: ID!, $planId: ID!) {
    assignPlanToInstitute(tenantId: $tenantId, planId: $planId) {
      id
      status
    }
  }
`;

/**
 * Resolver: @Args('input') input: CancelSubscriptionInput
 * CancelSubscriptionInput has: subscriptionId (required), reason (optional)
 */
const CANCEL_SUBSCRIPTION_MUTATION = gql`
  mutation CancelSubscription($input: CancelSubscriptionInput!) {
    cancelSubscription(input: $input) {
      id
      status
    }
  }
`;

/**
 * Resolver: @Args('input') input: PauseSubscriptionInput
 * PauseSubscriptionInput has: subscriptionId (required), reason (optional)
 */
const PAUSE_SUBSCRIPTION_MUTATION = gql`
  mutation PauseSubscription($input: PauseSubscriptionInput!) {
    pauseSubscription(input: $input) {
      id
      status
    }
  }
`;

/**
 * Resolver: @Args('subscriptionId', { type: () => ID }) subscriptionId: string
 * Takes a bare subscriptionId scalar argument.
 */
const RESUME_SUBSCRIPTION_MUTATION = gql`
  mutation ResumeSubscription($subscriptionId: ID!) {
    resumeSubscription(subscriptionId: $subscriptionId) {
      id
      status
    }
  }
`;

export function useSubscriptions(variables: SubscriptionsQueryVariables) {
  const { data, loading, error, refetch } = useQuery<
    SubscriptionsQueryData,
    SubscriptionsQueryVariables
  >(SUBSCRIPTIONS_QUERY, {
    variables,
    notifyOnNetworkStatusChange: true,
  });

  return {
    subscriptions: data?.subscriptions ?? [],
    loading,
    error,
    refetch,
  };
}

export function useAssignPlan() {
  return useMutation<
    { assignPlanToInstitute: { id: string; status: string } },
    { tenantId: string; planId: string }
  >(ASSIGN_PLAN_MUTATION, { refetchQueries: ['Subscriptions'] });
}

export function useCancelSubscription() {
  return useMutation<
    { cancelSubscription: { id: string; status: string } },
    { input: { subscriptionId: string; reason?: string } }
  >(CANCEL_SUBSCRIPTION_MUTATION, { refetchQueries: ['Subscriptions'], awaitRefetchQueries: true });
}

export function usePauseSubscription() {
  return useMutation<
    { pauseSubscription: { id: string; status: string } },
    { input: { subscriptionId: string; reason?: string } }
  >(PAUSE_SUBSCRIPTION_MUTATION, { refetchQueries: ['Subscriptions'], awaitRefetchQueries: true });
}

export function useResumeSubscription() {
  return useMutation<
    { resumeSubscription: { id: string; status: string } },
    { subscriptionId: string }
  >(RESUME_SUBSCRIPTION_MUTATION, { refetchQueries: ['Subscriptions'], awaitRefetchQueries: true });
}
