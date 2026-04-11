'use client';

import { gql, useQuery } from '@roviq/graphql';
import type { InvoiceModel } from '@roviq/graphql/generated';

export type InvoiceNode = InvoiceModel;

interface InvoicesQueryData {
  invoices: InvoiceNode[];
}

interface InvoicesQueryVariables {
  instituteId?: string | null;
  filter?: { status?: string; from?: string; to?: string } | null;
  first?: number;
  after?: string;
}

/**
 * Resolver returns `[InvoiceModel]` — a plain array, not a connection.
 * Args: instituteId (optional), filter (BillingFilterInput), first, after.
 */
const INVOICES_QUERY = gql`
  query Invoices($instituteId: ID, $filter: BillingFilterInput, $first: Int, $after: String) {
    invoices(instituteId: $instituteId, filter: $filter, first: $first, after: $after) {
      id
      tenantId
      subscriptionId
      resellerId
      invoiceNumber
      subscription {
        id
        institute {
          id
          name
        }
      }
      subtotalAmount
      taxAmount
      totalAmount
      paidAmount
      currency
      status
      periodStart
      periodEnd
      issuedAt
      dueAt
      paidAt
      lineItems
      taxBreakdown
      notes
      createdAt
    }
  }
`;

export function useInvoices(variables: InvoicesQueryVariables) {
  const { data, loading, error, refetch } = useQuery<InvoicesQueryData, InvoicesQueryVariables>(
    INVOICES_QUERY,
    {
      variables,
      notifyOnNetworkStatusChange: true,
    },
  );

  return {
    invoices: data?.invoices ?? [],
    loading,
    error,
    refetch,
  };
}
