/**
 * StudentAdmissionWorkflow (ROV-159).
 *
 * Temporal workflow: approved application → fully enrolled student.
 * 10 idempotent activity steps. Timeout: 5 minutes.
 */
import { proxyActivities } from '@temporalio/workflow';
import type {
  StudentAdmissionActivities,
  StudentAdmissionInput,
  StudentAdmissionResult,
} from './student-admission.types';

const activities = proxyActivities<StudentAdmissionActivities>({
  startToCloseTimeout: '2 minutes',
  retry: { maximumAttempts: 3 },
});

export async function StudentAdmissionWorkflow(
  input: StudentAdmissionInput,
): Promise<StudentAdmissionResult> {
  const { applicationId, tenantId } = input;
  const SYSTEM_ACTOR = 'SYSTEM';

  // 1. Load application + enquiry data
  const { application } = await activities.loadApplicationData(applicationId, tenantId);

  const formData = (application.formData ?? application.form_data ?? {}) as Record<string, unknown>;
  const standardId = (application.standardId ?? application.standard_id) as string;
  const sectionId = (application.sectionId ?? application.section_id) as string;
  const academicYearId = (application.academicYearId ?? application.academic_year_id) as string;
  const isRte = (application.isRteApplication ??
    application.is_rte_application ??
    false) as boolean;

  // 2. Validate section capacity
  if (sectionId) {
    await activities.validateSectionCapacity(tenantId, sectionId);
  }

  // 3. Auth NATS → create user + membership (student role)
  const { userId, membershipId } = await activities.createUserAndMembership(
    tenantId,
    formData,
    SYSTEM_ACTOR,
  );

  // 4. Create user_profile from form_data
  await activities.createUserProfile(userId, formData, SYSTEM_ACTOR);

  // 5. Create student_profile with admission_number
  const { studentProfileId, admissionNumber } = await activities.createStudentProfile(
    tenantId,
    userId,
    membershipId,
    standardId,
    formData,
    isRte,
    SYSTEM_ACTOR,
  );

  // 6. Create student_academics (section placement)
  if (sectionId) {
    await activities.createStudentAcademics(
      tenantId,
      studentProfileId,
      academicYearId,
      standardId,
      sectionId,
      SYSTEM_ACTOR,
    );
  }

  // 7. Link guardians from parent info
  await activities.linkGuardians(tenantId, studentProfileId, formData, SYSTEM_ACTOR);

  // 8. Update application: status='enrolled', student_profile_id
  await activities.updateApplicationEnrolled(
    applicationId,
    tenantId,
    studentProfileId,
    SYSTEM_ACTOR,
  );

  // 9. Emit student.admitted
  if (sectionId) {
    await activities.emitStudentAdmittedEvent(
      tenantId,
      studentProfileId,
      membershipId,
      standardId,
      sectionId,
    );
  }

  // 10. Apply previous school TC data if present
  await activities.applyPreviousSchoolData(tenantId, studentProfileId, formData, SYSTEM_ACTOR);

  return { studentProfileId, admissionNumber, membershipId };
}
