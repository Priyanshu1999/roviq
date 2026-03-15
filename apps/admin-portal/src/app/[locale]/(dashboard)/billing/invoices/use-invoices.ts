'use client';

import { gql, useQuery } from '@roviq/graphql';
import type { InvoicesQuery, InvoicesQueryVariables } from './use-invoices.generated';

export type InvoiceNode = InvoicesQuery['invoices']['edges'][number]['node'];

const INVOICES_QUERY = gql`
  query Invoices($organizationId: ID, $filter: BillingFilterInput, $first: Int, $after: String) {
    invoices(organizationId: $organizationId, filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          subscription {
            id
            organization {
              id
              name
            }
          }
          amount
          currency
          status
          providerInvoiceId
          providerPaymentId
          billingPeriodStart
          billingPeriodEnd
          dueDate
          paidAt
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

export function useInvoices(variables: InvoicesQueryVariables) {
  const { data, loading, error, fetchMore } = useQuery<InvoicesQuery, InvoicesQueryVariables>(
    INVOICES_QUERY,
    {
      variables,
      notifyOnNetworkStatusChange: true,
    },
  );

  const loadMore = () => {
    const endCursor = data?.invoices.pageInfo.endCursor;
    if (!endCursor) return;
    return fetchMore({ variables: { ...variables, after: endCursor } });
  };

  return {
    invoices: data?.invoices.edges.map((e) => e.node) ?? [],
    totalCount: data?.invoices.totalCount ?? 0,
    hasNextPage: data?.invoices.pageInfo.hasNextPage ?? false,
    loading,
    error,
    loadMore,
  };
}
