'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';
import type {
  AssignPlanToOrganizationMutation,
  AssignPlanToOrganizationMutationVariables,
  CancelSubscriptionMutation,
  CancelSubscriptionMutationVariables,
  PauseSubscriptionMutation,
  PauseSubscriptionMutationVariables,
  ResumeSubscriptionMutation,
  ResumeSubscriptionMutationVariables,
  SubscriptionsQuery,
  SubscriptionsQueryVariables,
} from './use-subscriptions.generated';

export type SubscriptionNode = SubscriptionsQuery['subscriptions']['edges'][number]['node'];

const SUBSCRIPTIONS_QUERY = gql`
  query Subscriptions($filter: SubscriptionFilterInput, $first: Int, $after: String) {
    subscriptions(filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          organization {
            id
            name
          }
          plan {
            id
            name
            amount
            currency
            billingInterval
          }
          status
          providerSubscriptionId
          providerCustomerId
          currentPeriodStart
          currentPeriodEnd
          canceledAt
          trialEndsAt
          createdAt
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        endCursor
        startCursor
      }
    }
  }
`;

const ASSIGN_PLAN_MUTATION = gql`
  mutation AssignPlanToOrganization($input: AssignPlanInput!) {
    assignPlanToOrganization(input: $input) {
      subscription {
        id
        status
      }
      checkoutUrl
    }
  }
`;

const CANCEL_SUBSCRIPTION_MUTATION = gql`
  mutation CancelSubscription($input: ManageSubscriptionInput!) {
    cancelSubscription(input: $input) {
      id
      status
    }
  }
`;

const PAUSE_SUBSCRIPTION_MUTATION = gql`
  mutation PauseSubscription($subscriptionId: ID!) {
    pauseSubscription(subscriptionId: $subscriptionId) {
      id
      status
    }
  }
`;

const RESUME_SUBSCRIPTION_MUTATION = gql`
  mutation ResumeSubscription($subscriptionId: ID!) {
    resumeSubscription(subscriptionId: $subscriptionId) {
      id
      status
    }
  }
`;

export function useSubscriptions(variables: SubscriptionsQueryVariables) {
  const { data, loading, error, fetchMore } = useQuery<
    SubscriptionsQuery,
    SubscriptionsQueryVariables
  >(SUBSCRIPTIONS_QUERY, {
    variables,
    notifyOnNetworkStatusChange: true,
  });

  const loadMore = () => {
    const endCursor = data?.subscriptions.pageInfo.endCursor;
    if (!endCursor) return;
    return fetchMore({ variables: { ...variables, after: endCursor } });
  };

  return {
    subscriptions: data?.subscriptions.edges.map((e) => e.node) ?? [],
    totalCount: data?.subscriptions.totalCount ?? 0,
    hasNextPage: data?.subscriptions.pageInfo.hasNextPage ?? false,
    loading,
    error,
    loadMore,
  };
}

export function useAssignPlan() {
  return useMutation<AssignPlanToOrganizationMutation, AssignPlanToOrganizationMutationVariables>(
    ASSIGN_PLAN_MUTATION,
    { refetchQueries: ['Subscriptions'] },
  );
}

export function useCancelSubscription() {
  return useMutation<CancelSubscriptionMutation, CancelSubscriptionMutationVariables>(
    CANCEL_SUBSCRIPTION_MUTATION,
    { refetchQueries: ['Subscriptions'], awaitRefetchQueries: true },
  );
}

export function usePauseSubscription() {
  return useMutation<PauseSubscriptionMutation, PauseSubscriptionMutationVariables>(
    PAUSE_SUBSCRIPTION_MUTATION,
    { refetchQueries: ['Subscriptions'], awaitRefetchQueries: true },
  );
}

export function useResumeSubscription() {
  return useMutation<ResumeSubscriptionMutation, ResumeSubscriptionMutationVariables>(
    RESUME_SUBSCRIPTION_MUTATION,
    { refetchQueries: ['Subscriptions'], awaitRefetchQueries: true },
  );
}
