'use client';

import { gql, useQuery } from '@roviq/graphql';

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

interface AuthEvent {
  id: string;
  userId: string | null;
  eventType: string;
  scope: string | null;
  tenantId: string | null;
  authMethod: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  failureReason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

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

export type { AuthEvent };
