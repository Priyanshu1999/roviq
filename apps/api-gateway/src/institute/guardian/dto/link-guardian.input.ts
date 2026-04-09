import { Field, ID, InputType } from '@nestjs/graphql';
import { GUARDIAN_RELATIONSHIP_VALUES } from '@roviq/common-types';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// Every property carries a class-validator decorator because the global
// ValidationPipe runs with `forbidNonWhitelisted: true` — undecorated
// properties are rejected at runtime as "property should not exist".
//
// `@IsUUID()` is called without a version argument because Roviq uses
// UUIDv7 for all primary keys (PostgreSQL 18 native `uuidv7()`); the
// default validator accepts any version and correctly validates v7 IDs.
//
// The `relationship` enum values come from `@roviq/common-types`
// (`GUARDIAN_RELATIONSHIP_VALUES`) so the DTO validator, the frontend
// Select options on the student detail Guardians tab and the guardian
// detail Children tab (ROV-224), and any future Drizzle pgEnum all read
// from a single source of truth. See CLAUDE.md "Single source of truth
// for cross-layer enums".

@InputType({
  description: 'Input for linking a guardian to a student with relationship metadata',
})
export class LinkGuardianInput {
  @Field(() => ID, { description: 'Guardian profile to link (tenant-scoped)' })
  @IsUUID()
  guardianProfileId!: string;

  @Field(() => ID, { description: 'Student profile to link to (tenant-scoped)' })
  @IsUUID()
  studentProfileId!: string;

  @Field({
    description:
      'Relationship to the student. Must be one of: ' +
      'father, mother, legal_guardian, grandparent_paternal, ' +
      'grandparent_maternal, uncle, aunt, sibling, other.',
  })
  @IsIn(GUARDIAN_RELATIONSHIP_VALUES, {
    message: `relationship must be one of: ${GUARDIAN_RELATIONSHIP_VALUES.join(', ')}`,
  })
  relationship!: string;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description:
      'Marks this guardian as the primary point of contact for the student. ' +
      'Only one primary is allowed per student — the service throws ConflictException ' +
      'if another guardian is already primary.',
  })
  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: false,
    description:
      'Marks this guardian as an emergency contact. Distinct from primary — used for ' +
      'medical incidents, early pickup, school closures, etc.',
  })
  @IsOptional()
  @IsBoolean()
  isEmergencyContact?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: true,
    description:
      'Whether this guardian is authorized to pick up the student from campus. ' +
      'Gate guards verify against this flag at the front gate.',
  })
  @IsOptional()
  @IsBoolean()
  canPickup?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    defaultValue: true,
    description:
      'Whether the student lives with this guardian. Used for address resolution, ' +
      'transport routing, and RTE home-distance verification.',
  })
  @IsOptional()
  @IsBoolean()
  livesWith?: boolean;
}

@InputType({
  description:
    'Input for unlinking a guardian from a student. If the unlinked guardian is ' +
    'the current primary contact, `newPrimaryGuardianId` MUST be provided — the ' +
    'service enforces that every student has exactly one primary.',
})
export class UnlinkGuardianInput {
  @Field(() => ID, { description: 'Guardian profile to unlink' })
  @IsUUID()
  guardianProfileId!: string;

  @Field(() => ID, { description: 'Student profile to unlink from' })
  @IsUUID()
  studentProfileId!: string;

  @Field(() => ID, {
    nullable: true,
    description:
      'Required only when unlinking the current primary contact — must reference another ' +
      'guardian already linked to this student who will become the new primary.',
  })
  @IsOptional()
  @IsUUID()
  newPrimaryGuardianId?: string;
}

@InputType({
  description:
    "Input for revoking a guardian's access to a student (divorce/separation/custody " +
    'scenario). Unlike Unlink, this preserves the link row for audit purposes and sets ' +
    "access flags to false — the guardian can still be viewed in the student's guardian " +
    'history but cannot pick up, receive notifications, or make payments.',
})
export class RevokeGuardianAccessInput {
  @Field(() => ID, { description: 'The guardian profile whose access is being revoked' })
  @IsUUID()
  guardianProfileId!: string;

  @Field(() => ID, { description: 'The student profile to revoke access for' })
  @IsUUID()
  studentProfileId!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Reason for revocation (logged to audit). Examples: "custody transferred by family ' +
      'court order 2026-03-15", "restraining order", "guardian deceased".',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
