import { Field, ID, InputType } from '@nestjs/graphql';

@InputType({ description: 'Input for linking a guardian to a student' })
export class LinkGuardianInput {
  @Field(() => ID)
  guardianProfileId!: string;

  @Field(() => ID)
  studentProfileId!: string;

  @Field({
    description:
      'Relationship: father/mother/legal_guardian/grandparent_paternal/grandparent_maternal/uncle/aunt/sibling/other',
  })
  relationship!: string;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  isPrimaryContact?: boolean;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  isEmergencyContact?: boolean;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  canPickup?: boolean;

  @Field(() => Boolean, { nullable: true, defaultValue: true })
  livesWith?: boolean;
}

@InputType({ description: 'Input for unlinking a guardian from a student' })
export class UnlinkGuardianInput {
  @Field(() => ID)
  guardianProfileId!: string;

  @Field(() => ID)
  studentProfileId!: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Required if unlinking the primary contact — assigns this guardian as new primary',
  })
  newPrimaryGuardianId?: string;
}

@InputType({ description: 'Revoke guardian access (divorce/separation scenario)' })
export class RevokeGuardianAccessInput {
  @Field(() => ID, { description: 'The guardian profile whose access is being revoked' })
  guardianProfileId!: string;

  @Field(() => ID, { description: 'The student profile to revoke access for' })
  studentProfileId!: string;

  @Field(() => String, { nullable: true, description: 'Reason for revocation (logged to audit)' })
  reason?: string;
}
