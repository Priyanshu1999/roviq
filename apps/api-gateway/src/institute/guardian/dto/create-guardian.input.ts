import { Field, ID, InputType } from '@nestjs/graphql';

@InputType({ description: 'Input for creating a guardian' })
export class CreateGuardianInput {
  @Field({ description: 'First name' })
  firstName!: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  gender?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  occupation?: string;

  @Field(() => String, { nullable: true })
  organization?: string;

  @Field(() => String, { nullable: true })
  educationLevel?: string;

  @Field(() => ID, {
    nullable: true,
    description: 'If provided, immediately link this guardian to a student',
  })
  studentProfileId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Relationship to the student: father/mother/legal_guardian/etc.',
  })
  relationship?: string;

  @Field(() => Boolean, { nullable: true, defaultValue: false })
  isPrimaryContact?: boolean;
}
