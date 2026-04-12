import { gql, useLazyQuery, useMutation, useQuery } from '@roviq/graphql';
import type {
  AcademicYearModel,
  CertificateModel,
  ListCertificateFilterInput,
  ListTcFilterInput,
  PreviewCertificateInput,
  RequestCertificateInput,
  RequestDuplicateTcInput,
  RequestTcInput,
  StudentModel,
  TcModel,
} from '@roviq/graphql/generated';

// ─── TC (Transfer Certificate) ──────────────────────────────────────────────

const TC_FIELDS = `
  id
  tcSerialNumber
  status
  reason
  isDuplicate
  isCounterSigned
  originalTcId
  pdfUrl
  qrVerificationUrl
  academicYearId
  studentProfileId
  studentFirstName
  studentLastName
  currentStandardName
  clearances { department cleared by at notes }
  tcData
  createdAt
`;

const LIST_TCS_QUERY = gql`
  query ListTCs($filter: ListTCFilterInput) {
    listTCs(filter: $filter) {
      ${TC_FIELDS}
    }
  }
`;

const GET_TC_QUERY = gql`
  query GetTCDetails($id: ID!) {
    getTCDetails(id: $id) {
      ${TC_FIELDS}
    }
  }
`;

const REQUEST_TC_MUTATION = gql`
  mutation RequestTC($input: RequestTCInput!) {
    requestTC(input: $input) {
      ${TC_FIELDS}
    }
  }
`;

const REQUEST_DUPLICATE_TC_MUTATION = gql`
  mutation RequestDuplicateTC($input: RequestDuplicateTCInput!) {
    requestDuplicateTC(input: $input) {
      ${TC_FIELDS}
    }
  }
`;

const APPROVE_TC_MUTATION = gql`
  mutation ApproveTC($id: ID!) {
    approveTC(id: $id) {
      ${TC_FIELDS}
    }
  }
`;

const REJECT_TC_MUTATION = gql`
  mutation RejectTC($id: ID!, $reason: String!) {
    rejectTC(id: $id, reason: $reason) {
      ${TC_FIELDS}
    }
  }
`;

const ISSUE_TC_MUTATION = gql`
  mutation IssueTC($id: ID!) {
    issueTC(id: $id) {
      ${TC_FIELDS}
    }
  }
`;

export type TCNode = TcModel;
export type TCListFilter = ListTcFilterInput;

export function useTCs(filter?: TCListFilter) {
  const { data, loading, refetch } = useQuery<{ listTCs: TCNode[] }>(LIST_TCS_QUERY, {
    variables: { filter: filter ?? {} },
    notifyOnNetworkStatusChange: true,
  });
  return {
    tcs: data?.listTCs ?? [],
    loading,
    refetch,
  };
}

export function useTC(id: string) {
  return useQuery<{ getTCDetails: TCNode }>(GET_TC_QUERY, {
    variables: { id },
    skip: !id,
  });
}

export type RequestTCInput = RequestTcInput;

export function useRequestTC() {
  return useMutation<{ requestTC: TCNode }, { input: RequestTCInput }>(REQUEST_TC_MUTATION, {
    refetchQueries: ['ListTCs'],
  });
}

export type RequestDuplicateTCInput = RequestDuplicateTcInput;

export function useRequestDuplicateTC() {
  return useMutation<{ requestDuplicateTC: TCNode }, { input: RequestDuplicateTCInput }>(
    REQUEST_DUPLICATE_TC_MUTATION,
    { refetchQueries: ['ListTCs', 'GetTCDetails'] },
  );
}

export function useApproveTC() {
  return useMutation<{ approveTC: TCNode }, { id: string }>(APPROVE_TC_MUTATION, {
    refetchQueries: ['ListTCs', 'GetTCDetails'],
  });
}

export function useRejectTC() {
  return useMutation<{ rejectTC: TCNode }, { id: string; reason: string }>(REJECT_TC_MUTATION, {
    refetchQueries: ['ListTCs', 'GetTCDetails'],
  });
}

export function useIssueTC() {
  return useMutation<{ issueTC: TCNode }, { id: string }>(ISSUE_TC_MUTATION, {
    refetchQueries: ['ListTCs', 'GetTCDetails'],
  });
}

// ─── Certificates ────────────────────────────────────────────────────────────

const CERTIFICATE_FIELDS = `
  id
  serialNumber
  status
  purpose
  templateId
  studentProfileId
  staffProfileId
  certificateData
  pdfUrl
  createdAt
`;

const LIST_CERTIFICATES_QUERY = gql`
  query ListCertificates($filter: ListCertificateFilterInput) {
    listCertificates(filter: $filter) {
      ${CERTIFICATE_FIELDS}
    }
  }
`;

const GET_CERTIFICATE_QUERY = gql`
  query GetCertificate($id: ID!) {
    getCertificate(id: $id) {
      ${CERTIFICATE_FIELDS}
    }
  }
`;

const REQUEST_CERTIFICATE_MUTATION = gql`
  mutation RequestCertificate($input: RequestCertificateInput!) {
    requestCertificate(input: $input) {
      ${CERTIFICATE_FIELDS}
    }
  }
`;

const ISSUE_CERTIFICATE_MUTATION = gql`
  mutation IssueCertificate($id: ID!) {
    issueCertificate(id: $id) {
      ${CERTIFICATE_FIELDS}
    }
  }
`;

export type CertificateNode = CertificateModel;
export type CertificateListFilter = ListCertificateFilterInput;

export function useCertificates(filter?: CertificateListFilter) {
  const { data, loading, refetch } = useQuery<{ listCertificates: CertificateNode[] }>(
    LIST_CERTIFICATES_QUERY,
    {
      variables: { filter: filter ?? {} },
      notifyOnNetworkStatusChange: true,
    },
  );
  return {
    certificates: data?.listCertificates ?? [],
    loading,
    refetch,
  };
}

export function useCertificate(id: string) {
  return useQuery<{ getCertificate: CertificateNode }>(GET_CERTIFICATE_QUERY, {
    variables: { id },
    skip: !id,
  });
}

export type { PreviewCertificateInput, RequestCertificateInput };

export function useRequestCertificate() {
  return useMutation<{ requestCertificate: CertificateNode }, { input: RequestCertificateInput }>(
    REQUEST_CERTIFICATE_MUTATION,
    { refetchQueries: ['ListCertificates'] },
  );
}

export function useIssueCertificate() {
  return useMutation<{ issueCertificate: CertificateNode }, { id: string }>(
    ISSUE_CERTIFICATE_MUTATION,
    { refetchQueries: ['ListCertificates', 'GetCertificate'] },
  );
}

// ─── Template field auto-populate + preview ─────────────────────────────────

const CERTIFICATE_TEMPLATE_FIELDS_QUERY = gql`
  query GetCertificateTemplateFields($templateId: ID!) {
    getCertificateTemplateFields(templateId: $templateId)
  }
`;

/**
 * Fetches the ordered list of placeholder field names for a certificate
 * template. Drives the auto-populated read-only fields inside the Issue
 * Certificate dialog (ROV-170).
 */
export function useCertificateTemplateFields(templateId: string | null | undefined) {
  return useQuery<{ getCertificateTemplateFields: string[] }>(CERTIFICATE_TEMPLATE_FIELDS_QUERY, {
    variables: { templateId: templateId ?? '' },
    skip: !templateId,
  });
}

const PREVIEW_CERTIFICATE_QUERY = gql`
  query PreviewCertificate($input: PreviewCertificateInput!) {
    previewCertificate(input: $input)
  }
`;

/**
 * Lazy query hook used by the "Preview" button in the Issue Certificate
 * dialog — renders the template with the selected student's data and
 * returns an HTML string that the frontend displays in an iframe.
 */
export function usePreviewCertificate() {
  return useLazyQuery<{ previewCertificate: string }, { input: PreviewCertificateInput }>(
    PREVIEW_CERTIFICATE_QUERY,
  );
}

// ─── Lightweight student picker (shared across dialogs) ─────────────────────

const STUDENTS_PICKER_QUERY = gql`
  query StudentsForCertificatePicker($filter: StudentFilterInput) {
    listStudents(filter: $filter) {
      edges {
        node {
          id
          admissionNumber
          firstName
          lastName
          currentStandardName
          currentSectionName
        }
      }
    }
  }
`;

export type StudentPickerNode = StudentModel;

export function useStudentPicker(search: string) {
  return useQuery<{
    listStudents: { edges: Array<{ node: StudentPickerNode }> };
  }>(STUDENTS_PICKER_QUERY, {
    variables: { filter: { first: 50, search: search || undefined } },
  });
}

// ─── Academic years for TC request dialog ────────────────────────────────────

const ACADEMIC_YEARS_QUERY = gql`
  query AcademicYearsForCertificates {
    academicYears {
      id
      label
      isActive
    }
  }
`;

export type AcademicYearPickerNode = AcademicYearModel;

export function useAcademicYearsForCertificates() {
  return useQuery<{ academicYears: AcademicYearPickerNode[] }>(ACADEMIC_YEARS_QUERY);
}
