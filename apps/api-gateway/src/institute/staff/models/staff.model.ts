import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Staff member profile with employment details' })
export class StaffModel {
  @Field(() => ID)
  id!: string;

  @Field()
  userId!: string;

  @Field()
  membershipId!: string;

  @Field(() => String, { nullable: true, description: 'Institute-assigned employee ID' })
  employeeId?: string | null;

  @Field(() => String, { nullable: true })
  designation?: string | null;

  @Field(() => String, { nullable: true })
  department?: string | null;

  @Field(() => String, { nullable: true })
  dateOfJoining?: string | null;

  @Field(() => String, { nullable: true })
  dateOfLeaving?: string | null;

  @Field(() => String, { nullable: true })
  employmentType?: string | null;

  @Field(() => Boolean)
  isClassTeacher!: boolean;

  @Field(() => String, { nullable: true })
  socialCategory?: string | null;

  @Field(() => String, { nullable: true })
  specialization?: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

@ObjectType({ description: 'Staff statistics by department' })
export class StaffStatistics {
  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  active!: number;

  @Field(() => Int)
  classTeachers!: number;

  @Field(() => [DepartmentCount])
  byDepartment!: DepartmentCount[];
}

@ObjectType()
export class DepartmentCount {
  @Field()
  department!: string;

  @Field(() => Int)
  count!: number;
}
