import { Field, InputType } from '@nestjs/graphql';

@InputType({ description: 'Input for creating a new staff member' })
export class CreateStaffInput {
  @Field({ description: 'First name of the staff member' })
  firstName!: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true, description: 'Gender: male/female/other' })
  gender?: string;

  @Field(() => String, { nullable: true })
  dateOfBirth?: string;

  @Field(() => String, { nullable: true, description: 'Email address' })
  email?: string;

  @Field(() => String, { nullable: true, description: '10-digit Indian mobile number' })
  phone?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Job title (e.g., PGT Physics, TGT Mathematics)',
  })
  designation?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Department (e.g., Science, Commerce, Administration)',
  })
  department?: string;

  @Field(() => String, { nullable: true, description: 'Date of joining (YYYY-MM-DD)' })
  dateOfJoining?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Employment type: regular/contractual/part_time/guest/volunteer',
  })
  employmentType?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Subject specialization (coaching-specific)',
  })
  specialization?: string;
}
