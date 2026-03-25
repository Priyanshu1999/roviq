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
