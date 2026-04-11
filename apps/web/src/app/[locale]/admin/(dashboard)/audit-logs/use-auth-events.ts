'use client';

import { gql, useQuery } from '@roviq/graphql';
import type { AuthEventModel } from '@roviq/graphql/generated';

const AUTH_EVENTS_QUERY = gql`
  query AuthEvents($first: Int) {
    authEvents(first: $first) {
      id
      userId
      eventType
      scope
      tenantId
      authMethod
      ipAddress
      userAgent
      failureReason
      metadata
      createdAt
    }
  }
`;

export type AuthEvent = AuthEventModel;

export function useAuthEvents(first = 50) {
  const { data, loading, refetch } = useQuery<{ authEvents: AuthEvent[] }>(AUTH_EVENTS_QUERY, {
    variables: { first },
    pollInterval: 10000,
  });

  return {
    events: data?.authEvents ?? [],
    loading,
    refetch,
  };
}
