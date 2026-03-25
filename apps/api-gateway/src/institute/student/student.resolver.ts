import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { pubSub } from '../../common/pubsub';
import { CreateStudentInput } from './dto/create-student.input';
import { StudentFilterInput } from './dto/student-filter.input';
import { UpdateStudentInput } from './dto/update-student.input';
import { StudentConnection, StudentModel } from './models/student.model';
import { StudentStatisticsModel } from './models/student-statistics.model';
import { StudentService } from './student.service';

@InstituteScope()
@UseGuards(AbilityGuard)
@Resolver(() => StudentModel)
export class StudentResolver {
  constructor(private readonly studentService: StudentService) {}

  @Query(() => StudentConnection, { description: 'List students with filters and pagination' })
  @CheckAbility('read', 'Student')
  async listStudents(
    @Args('filter', { nullable: true }) filter?: StudentFilterInput,
  ): Promise<InstanceType<typeof StudentConnection>> {
    return this.studentService.list(filter ?? {});
  }

  @Query(() => StudentModel, { description: 'Get a student by ID' })
  @CheckAbility('read', 'Student')
  async getStudent(@Args('id', { type: () => ID }) id: string): Promise<StudentModel> {
    return this.studentService.findById(id);
  }

  @Query(() => StudentStatisticsModel, { description: 'Aggregate student statistics' })
  @CheckAbility('read', 'Student')
  async studentStatistics(): Promise<StudentStatisticsModel> {
    return this.studentService.statistics();
  }

  @Mutation(() => StudentModel, { description: 'Create a new student with admission' })
  @CheckAbility('create', 'Student')
  async createStudent(@Args('input') input: CreateStudentInput): Promise<StudentModel> {
    return this.studentService.create(input);
  }

  @Mutation(() => StudentModel, { description: 'Update student profile (optimistic concurrency)' })
  @CheckAbility('update', 'Student')
  async updateStudent(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStudentInput,
  ): Promise<StudentModel> {
    return this.studentService.update(id, input);
  }

  @Mutation(() => Boolean, { description: 'Soft delete a student profile' })
  @CheckAbility('delete', 'Student')
  async deleteStudent(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.studentService.delete(id);
  }

  /** Real-time student updates — filtered by tenantId from JWT */
  @Subscription(() => StudentModel, {
    filter: (
      payload: { studentUpdated: { tenantId: string } },
      _variables: { studentId: string },
      context: { req: { user: AuthUser } },
    ) => payload.studentUpdated.tenantId === context.req.user.tenantId,
  })
  studentUpdated(@Args('studentId', { type: () => ID }) _studentId: string) {
    return pubSub.asyncIterableIterator('STUDENT.updated');
  }
}
