'use client';

import { gql, useLazyQuery, useMutation, useQuery } from '@roviq/graphql';
import type { InvoiceModel, PaymentModel, SubscriptionModel } from '@roviq/graphql/generated';

export type MySubscription = SubscriptionModel;

interface MySubscriptionQuery {
  mySubscription: MySubscription | null;
}

export type MyInvoice = InvoiceModel;

interface MyInvoicesQuery {
  myInvoices: MyInvoice[];
}

interface MyInvoiceQuery {
  myInvoice: MyInvoice | null;
}

type MyPayment = PaymentModel;

interface SubmitUpiProofData {
  submitUpiProof: { id: string; verificationStatus: string; utrNumber: string };
}

interface SubmitUpiProofVariables {
  input: { invoiceId: string; utrNumber: string };
}

interface GenerateInvoicePdfData {
  generateInvoicePdf: string;
}

interface GenerateInvoicePdfVariables {
  invoiceId: string;
}

interface InitiatePaymentData {
  initiatePayment: {
    paymentId: string;
    gatewayOrderId: string;
    checkoutUrl: string | null;
    checkoutPayload: Record<string, unknown> | null;
  };
}

interface InitiatePaymentVariables {
  invoiceId: string;
}

interface MyPaymentHistoryQuery {
  myPaymentHistory: MyPayment[];
}

const MY_SUBSCRIPTION_QUERY = gql`
  query MySubscription {
    mySubscription {
      id tenantId planId resellerId status
      currentPeriodStart currentPeriodEnd
      cancelledAt trialEndsAt createdAt
      plan { id name interval amount entitlements }
    }
  }
`;

const MY_INVOICE_QUERY = gql`
  query MyInvoice($id: ID!) {
    myInvoice(id: $id) {
      id invoiceNumber status subtotalAmount taxAmount totalAmount paidAmount
      currency periodStart periodEnd dueAt paidAt issuedAt
      lineItems notes upiPaymentUri
    }
  }
`;

const MY_INVOICES_QUERY = gql`
  query MyInvoices($first: Int, $after: String) {
    myInvoices(first: $first, after: $after) {
      id tenantId invoiceNumber status
      subtotalAmount taxAmount totalAmount paidAmount currency
      periodStart periodEnd dueAt paidAt createdAt
    }
  }
`;

const MY_PAYMENT_HISTORY_QUERY = gql`
  query MyPaymentHistory($first: Int, $after: String) {
    myPaymentHistory(first: $first, after: $after) {
      id invoiceId status method amountPaise currency
      gatewayProvider receiptNumber verificationStatus utrNumber paidAt createdAt
    }
  }
`;

const SUBMIT_UPI_PROOF_MUTATION = gql`
  mutation SubmitUpiProof($input: SubmitUpiProofInput!) {
    submitUpiProof(input: $input) {
      id
      verificationStatus
      utrNumber
    }
  }
`;

const GENERATE_INVOICE_PDF_QUERY = gql`
  query GenerateInvoicePdf($invoiceId: ID!) {
    generateInvoicePdf(invoiceId: $invoiceId)
  }
`;

const INITIATE_PAYMENT_MUTATION = gql`
  mutation InitiatePayment($invoiceId: ID!) {
    initiatePayment(invoiceId: $invoiceId) {
      paymentId
      gatewayOrderId
      checkoutUrl
      checkoutPayload
    }
  }
`;

export function useMySubscription() {
  const { data, loading, error } = useQuery<MySubscriptionQuery>(MY_SUBSCRIPTION_QUERY);
  return { subscription: data?.mySubscription ?? null, loading, error };
}

export function useMyInvoice(id: string) {
  const { data, loading, error } = useQuery<MyInvoiceQuery>(MY_INVOICE_QUERY, {
    variables: { id },
    skip: !id,
  });
  return { invoice: data?.myInvoice ?? null, loading, error };
}

export function useMyInvoices(first = 20, after?: string) {
  const { data, loading, error } = useQuery<MyInvoicesQuery>(MY_INVOICES_QUERY, {
    variables: { first, after },
  });
  return { invoices: data?.myInvoices ?? [], loading, error };
}

export function useMyPaymentHistory(first = 20, after?: string) {
  const { data, loading, error } = useQuery<MyPaymentHistoryQuery>(MY_PAYMENT_HISTORY_QUERY, {
    variables: { first, after },
  });
  return { payments: data?.myPaymentHistory ?? [], loading, error };
}

export function useSubmitUpiProof() {
  return useMutation<SubmitUpiProofData, SubmitUpiProofVariables>(SUBMIT_UPI_PROOF_MUTATION, {
    refetchQueries: ['MyInvoice', 'MyPaymentHistory'],
    awaitRefetchQueries: true,
  });
}

export function useGenerateInvoicePdf() {
  return useLazyQuery<GenerateInvoicePdfData, GenerateInvoicePdfVariables>(
    GENERATE_INVOICE_PDF_QUERY,
  );
}

export function useInitiatePayment() {
  return useMutation<InitiatePaymentData, InitiatePaymentVariables>(INITIATE_PAYMENT_MUTATION, {
    refetchQueries: ['MyInvoice', 'MyPaymentHistory'],
  });
}
