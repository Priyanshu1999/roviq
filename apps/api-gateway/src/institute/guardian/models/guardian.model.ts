import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GuardianEducationLevel } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import { I18nTextScalar } from '@roviq/nestjs-graphql';

registerEnumType(GuardianEducationLevel, {
  name: 'GuardianEducationLevel',
  description: "Guardian's highest completed education level.",
});

@ObjectType({
  description: 'Guardian profile with occupation, joined display name, and linked students',
})
export class GuardianModel {
  @Field(() => ID, { description: 'Guardian profile UUIDv7 — stable primary key.' })
  id!: string;

  @Field({ description: 'Underlying user account id — shared with other profile types.' })
  userId!: string;

  @Field({
    description: 'Membership row linking this guardian to the current institute (tenant) and role.',
  })
  membershipId!: string;

  @Field(() => I18nTextScalar, {
    description:
      'Guardian first name as an i18nText map. Always includes `en`; frontend resolves via useI18nField().',
  })
  firstName!: I18nContent;

  @Field(() => I18nTextScalar, {
    nullable: true,
    description:
      'Guardian last name as an i18nText map. Nullable because single-name cultures exist.',
  })
  lastName?: I18nContent | null;

  @Field(() => String, {
    nullable: true,
    description: 'Absolute URL of the guardian profile photo, or null before any upload.',
  })
  profileImageUrl?: string | null;

  @Field(() => String, {
    nullable: true,
    description: "Gender from user_profiles: 'male', 'female', or 'other'.",
  })
  gender?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Guardian occupation (free text, e.g. "Engineer", "Shopkeeper", "Homemaker").',
  })
  occupation?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Employer / organisation the guardian works at (free text).',
  })
  organization?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Guardian job title inside their organisation (free text).',
  })
  designation?: string | null;

  @Field(() => GuardianEducationLevel, {
    nullable: true,
    description:
      "Guardian's highest completed education level — constrained enum mirroring the chk_education_level DB check.",
  })
  educationLevel?: GuardianEducationLevel | null;

  @Field(() => String, {
    nullable: true,
    description:
      'Primary phone number (is_primary=true) surfaced for quick-dial and search. Null when the guardian has no phone on file.',
  })
  primaryPhone?: string | null;

  @Field(() => Int, {
    description:
      'Number of students linked to this guardian via student_guardian_links — precomputed to avoid an N+1 on the list page.',
  })
  linkedStudentCount!: number;

  @Field(() => Int, {
    description:
      'Optimistic-concurrency version. Increments on every write; clients must send the expected value on update.',
  })
  version!: number;

  @Field({ description: 'Guardian profile creation timestamp (UTC).' })
  createdAt!: Date;

  @Field({ description: 'Most recent update timestamp (UTC).' })
  updatedAt!: Date;
}

@ObjectType({ description: 'Student-guardian link with relationship details' })
export class GuardianLinkModel {
  @Field(() => ID, { description: 'student_guardian_links row id — stable UUIDv7.' })
  id!: string;

  @Field({ description: 'Linked student_profiles.id.' })
  studentProfileId!: string;

  @Field({ description: 'Linked guardian_profiles.id.' })
  guardianProfileId!: string;

  @Field({
    description:
      'Relationship of guardian to student: father, mother, legal_guardian, grandparent_paternal, grandparent_maternal, uncle, aunt, sibling, or other.',
  })
  relationship!: string;

  @Field({
    description:
      'True if this guardian is the primary contact for the student. Exactly one primary per student is enforced at the service layer.',
  })
  isPrimaryContact!: boolean;

  @Field({
    description:
      'True if this guardian should be contacted in case of emergencies. Multiple emergency contacts are allowed.',
  })
  isEmergencyContact!: boolean;

  @Field({ description: 'True if this guardian is authorised to pick the student up from campus.' })
  canPickup!: boolean;

  @Field({ description: 'True if the student lives in the same household as this guardian.' })
  livesWith!: boolean;
}

/**
 * Read model for the "Guardians" tab on the student detail page (ROV-167):
 * a guardian linked to a specific student, with the link metadata
 * (relationship, primary flag) and the guardian's resolved name + contact
 * info from user_profiles. Avoids cascading queries on the frontend.
 */
@ObjectType({
  description: 'Guardian linked to a student, joined with display name and link metadata',
})
export class StudentGuardianModel {
  @Field(() => ID, {
    description: 'student_guardian_links row id — needed for unlink / update-link mutations.',
  })
  linkId!: string;

  @Field({ description: 'guardian_profiles.id for the linked guardian.' })
  guardianProfileId!: string;

  @Field({ description: 'Underlying user account id of the guardian.' })
  userId!: string;

  @Field(() => I18nTextScalar, {
    description: "Guardian's first name (i18nText); resolved client-side via useI18nField().",
  })
  firstName!: I18nContent;

  @Field(() => I18nTextScalar, {
    nullable: true,
    description: "Guardian's last name (i18nText); optional.",
  })
  lastName?: I18nContent | null;

  @Field(() => String, {
    nullable: true,
    description: 'Profile photo URL, or null before upload.',
  })
  profileImageUrl?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Guardian occupation (free text).',
  })
  occupation?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Employer / organisation (free text).',
  })
  organization?: string | null;

  @Field({
    description:
      'Relationship of guardian to student: father, mother, legal_guardian, grandparent_paternal, grandparent_maternal, uncle, aunt, sibling, or other.',
  })
  relationship!: string;

  @Field({ description: 'True if this guardian is the primary contact for the student.' })
  isPrimaryContact!: boolean;

  @Field({ description: 'True if this guardian should be contacted in emergencies.' })
  isEmergencyContact!: boolean;

  @Field({ description: 'True if this guardian is authorised to pick the student up.' })
  canPickup!: boolean;

  @Field({ description: 'True if the student lives with this guardian.' })
  livesWith!: boolean;
}

/**
 * Read model for the "Linked Children" tab on the guardian detail page (ROV-169):
 * a student linked to a specific guardian, with the child's resolved display
 * name, admission number, current class/section, and the link metadata
 * (relationship, primary contact). Mirrors StudentGuardianModel but from the
 * opposite side of the relationship.
 */
@ObjectType({
  description: 'Student linked to a guardian, with resolved name/class/section and link metadata',
})
export class GuardianLinkedStudentModel {
  @Field(() => ID, {
    description: 'student_guardian_links row id — used by the unlink mutation.',
  })
  linkId!: string;

  @Field(() => ID, { description: 'student_profiles.id for the linked student.' })
  studentProfileId!: string;

  @Field(() => I18nTextScalar, {
    description: "Student's first name (i18nText) from user_profiles.",
  })
  firstName!: I18nContent;

  @Field(() => I18nTextScalar, {
    nullable: true,
    description: "Student's last name (i18nText) from user_profiles; optional.",
  })
  lastName?: I18nContent | null;

  @Field({
    description: 'Institute-issued admission number. Plain string — never translated.',
  })
  admissionNumber!: string;

  @Field(() => I18nTextScalar, {
    nullable: true,
    description:
      'Current-year standard (class) name as i18nText. Null when the student has no active enrollment.',
  })
  currentStandardName?: I18nContent | null;

  @Field(() => I18nTextScalar, {
    nullable: true,
    description:
      'Current-year section name as i18nText. Null when the student has no active enrollment.',
  })
  currentSectionName?: I18nContent | null;

  @Field(() => String, {
    nullable: true,
    description: 'Student profile photo URL, or null before upload.',
  })
  profileImageUrl?: string | null;

  @Field({
    description:
      'Relationship of guardian to student: father, mother, legal_guardian, grandparent_paternal, grandparent_maternal, uncle, aunt, sibling, or other.',
  })
  relationship!: string;

  @Field({ description: 'True if the linked guardian is the primary contact for this student.' })
  isPrimaryContact!: boolean;

  @Field({ description: 'True if the linked guardian should be contacted in emergencies.' })
  isEmergencyContact!: boolean;

  @Field({ description: 'True if the linked guardian is authorised to pick the student up.' })
  canPickup!: boolean;

  @Field({ description: 'True if the student lives with the linked guardian.' })
  livesWith!: boolean;
}
