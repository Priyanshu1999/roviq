import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { EnrollStudentInput, UpdateStudentSectionInput } from './dto/enroll-student.input';
import { StudentAcademicHistoryModel } from './models/student-academic-history.model';
import { StudentAcademicService } from './student-academic.service';

@InstituteScope()
@UseGuards(AbilityGuard)
@Resolver()
export class StudentAcademicResolver {
  constructor(private readonly academicService: StudentAcademicService) {}

  @Query(() => [StudentAcademicHistoryModel], {
    description:
      'Year-by-year academic history for a single student (Academics tab on detail page).',
  })
  @CheckAbility('read', 'Student')
  async listStudentAcademics(
    @Args('studentProfileId', { type: () => ID }) studentProfileId: string,
  ): Promise<StudentAcademicHistoryModel[]> {
    return this.academicService.listForStudent(studentProfileId);
  }

  @Mutation(() => ID, { description: 'Enroll a student in a section with capacity check' })
  @CheckAbility('create', 'Student')
  async enrollStudent(@Args('input') input: EnrollStudentInput): Promise<string> {
    const result = await this.academicService.enroll(input);
    return result.id;
  }

  @Mutation(() => ID, { description: 'Change student section with capacity check' })
  @CheckAbility('update', 'Student')
  async updateStudentSection(@Args('input') input: UpdateStudentSectionInput): Promise<string> {
    const result = await this.academicService.changeSection(input);
    return result.id;
  }
}
