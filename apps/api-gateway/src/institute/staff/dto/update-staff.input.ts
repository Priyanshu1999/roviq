import { Field, InputType, Int } from '@nestjs/graphql';

@InputType({ description: 'Input for updating staff member — optimistic concurrency via version' })
export class UpdateStaffInput {
  @Field(() => String, { nullable: true })
  designation?: string;

  @Field(() => String, { nullable: true })
  department?: string;

  @Field(() => String, { nullable: true })
  employmentType?: string;

  @Field(() => Boolean, { nullable: true })
  isClassTeacher?: boolean;

  @Field(() => String, { nullable: true })
  specialization?: string;

  @Field(() => String, { nullable: true })
  socialCategory?: string;

  @Field(() => Int, { description: 'Current version for optimistic concurrency' })
  version!: number;
}
