import { Field, InputType, Int } from '@nestjs/graphql';

@InputType({ description: 'Filter for listing staff members' })
export class ListStaffFilterInput {
  @Field(() => String, { nullable: true, description: 'Filter by department' })
  department?: string;

  @Field(() => String, { nullable: true, description: 'Filter by designation' })
  designation?: string;

  @Field(() => String, { nullable: true, description: 'Filter by employment type' })
  employmentType?: string;

  @Field(() => Boolean, { nullable: true, description: 'Filter class teachers only' })
  isClassTeacher?: boolean;

  @Field(() => String, { nullable: true, description: 'Search by name' })
  search?: string;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  first?: number;

  @Field(() => String, { nullable: true, description: 'Cursor for pagination' })
  after?: string;
}
