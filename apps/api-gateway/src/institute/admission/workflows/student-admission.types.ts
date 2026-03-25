/**
 * Types for StudentAdmissionWorkflow (ROV-159).
 *
 * Temporal workflow that converts an approved admission application
 * into a fully enrolled student — creating user, membership, profiles,
 * academics, and linking guardians.
 */

export interface StudentAdmissionInput {
  applicationId: string;
  tenantId: string;
}

export interface StudentAdmissionResult {
  studentProfileId: string;
  admissionNumber: string;
  membershipId: string;
}

export interface StudentAdmissionActivities {
  loadApplicationData(
    applicationId: string,
    tenantId: string,
  ): Promise<{
    application: Record<string, unknown>;
    enquiry: Record<string, unknown> | null;
  }>;

  validateSectionCapacity(tenantId: string, sectionId: string): Promise<void>;

  createUserAndMembership(
    tenantId: string,
    formData: Record<string, unknown>,
    createdBy: string,
  ): Promise<{ userId: string; membershipId: string }>;

  createUserProfile(
    userId: string,
    formData: Record<string, unknown>,
    createdBy: string,
  ): Promise<void>;

  createStudentProfile(
    tenantId: string,
    userId: string,
    membershipId: string,
    standardId: string,
    formData: Record<string, unknown>,
    isRte: boolean,
    createdBy: string,
  ): Promise<{ studentProfileId: string; admissionNumber: string }>;

  createStudentAcademics(
    tenantId: string,
    studentProfileId: string,
    academicYearId: string,
    standardId: string,
    sectionId: string,
    createdBy: string,
  ): Promise<void>;

  linkGuardians(
    tenantId: string,
    studentProfileId: string,
    formData: Record<string, unknown>,
    createdBy: string,
  ): Promise<void>;

  updateApplicationEnrolled(
    applicationId: string,
    tenantId: string,
    studentProfileId: string,
    updatedBy: string,
  ): Promise<void>;

  emitStudentAdmittedEvent(
    tenantId: string,
    studentProfileId: string,
    membershipId: string,
    standardId: string,
    sectionId: string,
  ): Promise<void>;

  applyPreviousSchoolData(
    tenantId: string,
    studentProfileId: string,
    formData: Record<string, unknown>,
    updatedBy: string,
  ): Promise<void>;
}
