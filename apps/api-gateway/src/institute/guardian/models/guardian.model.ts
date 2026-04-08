import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Guardian profile with occupation and linked students' })
export class GuardianModel {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  membershipId!: string;

  @Field(() => String, { nullable: true })
  occupation?: string | null;

  @Field(() => String, { nullable: true })
  organization?: string | null;

  @Field(() => String, { nullable: true })
  designation?: string | null;

  @Field(() => String, { nullable: true })
  educationLevel?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType({ description: 'Student-guardian link with relationship details' })
export class GuardianLinkModel {
  @Field(() => ID)
  id!: string;

  @Field()
  studentProfileId!: string;

  @Field()
  guardianProfileId!: string;

  @Field({
    description:
      'Relationship: father/mother/legal_guardian/grandparent_paternal/grandparent_maternal/uncle/aunt/sibling/other',
  })
  relationship!: string;

  @Field()
  isPrimaryContact!: boolean;

  @Field()
  isEmergencyContact!: boolean;

  @Field()
  canPickup!: boolean;

  @Field()
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
  /** student_guardian_links.id — used for unlink/revoke mutations. */
  @Field(() => ID)
  linkId!: string;

  @Field()
  guardianProfileId!: string;

  @Field()
  userId!: string;

  @Field()
  firstName!: string;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => String, { nullable: true })
  profileImageUrl?: string | null;

  @Field(() => String, { nullable: true })
  occupation?: string | null;

  @Field(() => String, { nullable: true })
  organization?: string | null;

  @Field()
  relationship!: string;

  @Field()
  isPrimaryContact!: boolean;

  @Field()
  isEmergencyContact!: boolean;

  @Field()
  canPickup!: boolean;

  @Field()
  livesWith!: boolean;
}
