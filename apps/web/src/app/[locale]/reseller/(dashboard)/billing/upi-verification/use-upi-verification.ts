'use client';

import { gql, useMutation, useQuery } from '@roviq/graphql';
import type { PaymentModel } from '@roviq/graphql/generated';

export type UnverifiedPaymentNode = PaymentModel;

interface UnverifiedPaymentsQueryData {
  unverifiedPayments: UnverifiedPaymentNode[];
}

interface UnverifiedPaymentsQueryVariables {
  first?: number;
}

const UNVERIFIED_PAYMENTS_QUERY = gql`
  query UnverifiedPayments($first: Int) {
    unverifiedPayments(first: $first) {
      id
      invoiceId
      tenantId
      amountPaise
      currency
      utrNumber
      verificationDeadline
      createdAt
    }
  }
`;

const VERIFY_UPI_MUTATION = gql`
  mutation VerifyUpi($paymentId: ID!) {
    verifyUpiPayment(paymentId: $paymentId) {
      id
      verificationStatus
    }
  }
`;

const REJECT_UPI_MUTATION = gql`
  mutation RejectUpi($input: RejectUpiInput!) {
    rejectUpiPayment(input: $input) {
      id
      verificationStatus
    }
  }
`;

export function useUnverifiedPayments(variables: UnverifiedPaymentsQueryVariables = {}) {
  const { data, loading, error, refetch } = useQuery<
    UnverifiedPaymentsQueryData,
    UnverifiedPaymentsQueryVariables
  >(UNVERIFIED_PAYMENTS_QUERY, {
    variables,
    notifyOnNetworkStatusChange: true,
  });

  return {
    payments: data?.unverifiedPayments ?? [],
    loading,
    error,
    refetch,
  };
}

export function useVerifyUpiPayment() {
  return useMutation(VERIFY_UPI_MUTATION, {
    refetchQueries: ['UnverifiedPayments', 'Invoices', 'ResellerBillingDashboard'],
  });
}

export function useRejectUpiPayment() {
  return useMutation(REJECT_UPI_MUTATION, {
    refetchQueries: ['UnverifiedPayments', 'Invoices', 'ResellerBillingDashboard'],
  });
}
