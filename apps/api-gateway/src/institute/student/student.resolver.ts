import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { AcademicStatus } from '@roviq/common-types';
import { pubSub } from '../../common/pubsub';
import { CreateStudentInput } from './dto/create-student.input';
import { StudentFilterInput } from './dto/student-filter.input';
import { UpdateStudentInput } from './dto/update-student.input';
import { UploadStudentDocumentInput } from './dto/upload-student-document.input';
import { StudentConnection, StudentModel } from './models/student.model';
import { StudentDocumentModel } from './models/student-document.model';
import { StudentStatisticsModel } from './models/student-statistics.model';
import { StudentService } from './student.service';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
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

  @Query(() => [StudentDocumentModel], {
    description: 'List uploaded documents for a single student (Documents tab on detail page).',
  })
  @CheckAbility('read', 'Student')
  async listStudentDocuments(
    @Args('studentProfileId', { type: () => ID }) studentProfileId: string,
  ): Promise<StudentDocumentModel[]> {
    return this.studentService.listDocumentsForStudent(studentProfileId);
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

  @Mutation(() => StudentModel, {
    description:
      'Explicit academic status transition (named domain mutation). Validates against the status state machine and emits STUDENT.statusChanged.',
  })
  @CheckAbility('update', 'Student')
  async transitionStudentStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('newStatus', { type: () => AcademicStatus }) newStatus: AcademicStatus,
    @Args('reason', { nullable: true }) reason?: string,
  ): Promise<StudentModel> {
    return this.studentService.transitionStatus(id, newStatus, reason);
  }

  @Mutation(() => StudentDocumentModel, {
    description:
      'Records an uploaded document (client uploads file bytes to object storage first, then calls this mutation with the resulting URLs).',
  })
  @CheckAbility('update', 'Student')
  async uploadStudentDocument(
    @Args('input') input: UploadStudentDocumentInput,
  ): Promise<StudentDocumentModel> {
    return this.studentService.uploadDocument(input);
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

  /**
   * Tenant-wide student updates for list-page live refresh. Any student
   * mutated within the viewer's tenant is pushed; the frontend uses this
   * to trigger a refetch on the students table without arguments.
   * Subscription payload reuses the single-student channel `STUDENT.updated`.
   */
  @Subscription(() => StudentModel, {
    name: 'studentsInTenantUpdated',
    resolve: (payload: { studentUpdated: StudentModel }) => payload.studentUpdated,
    filter: (
      payload: { studentUpdated: { tenantId: string } },
      _variables: Record<string, never>,
      context: { req: { user: AuthUser } },
    ) => payload.studentUpdated.tenantId === context.req.user.tenantId,
  })
  studentsInTenantUpdated() {
    return pubSub.asyncIterableIterator('STUDENT.updated');
  }
}
