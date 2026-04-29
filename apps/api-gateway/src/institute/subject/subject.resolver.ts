import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { CreateSubjectInput } from './dto/create-subject.input';
import { UpdateSubjectInput } from './dto/update-subject.input';
import { SubjectModel } from './models/subject.model';
import type { SubjectRecord } from './repositories/types';
import { SubjectService } from './subject.service';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => SubjectModel)
export class SubjectResolver {
  constructor(private readonly subjectService: SubjectService) {}

  @Query(() => [SubjectModel], { description: 'List every subject in the current institute.' })
  @CheckAbility('read', 'Subject')
  async subjects(): Promise<SubjectRecord[]> {
    return this.subjectService.findAll();
  }

  @Query(() => SubjectModel, { description: 'Fetch a subject by id.' })
  @CheckAbility('read', 'Subject')
  async subject(@Args('id', { type: () => ID }) id: string): Promise<SubjectRecord> {
    return this.subjectService.findById(id);
  }

  @Query(() => [SubjectModel], {
    description: 'Subjects linked to the given standard via `standard_subjects`.',
  })
  @CheckAbility('read', 'Subject')
  async subjectsByStandard(
    @Args('standardId', { type: () => ID }) standardId: string,
  ): Promise<SubjectRecord[]> {
    return this.subjectService.findByStandard(standardId);
  }

  @Mutation(() => SubjectModel, { description: 'Create a subject in the current institute.' })
  @CheckAbility('create', 'Subject')
  async createSubject(@Args('input') input: CreateSubjectInput): Promise<SubjectRecord> {
    return this.subjectService.create(input);
  }

  @Mutation(() => SubjectModel, { description: 'Update an existing subject by id.' })
  @CheckAbility('update', 'Subject')
  async updateSubject(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSubjectInput,
  ): Promise<SubjectRecord> {
    return this.subjectService.update(id, input);
  }

  @Mutation(() => Boolean, {
    description: 'Soft-delete a subject. Returns true on success.',
  })
  @CheckAbility('delete', 'Subject')
  async deleteSubject(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.subjectService.delete(id);
  }

  // SS-004: assign / remove mutations now return the affected SubjectModel
  // for cache-update parity with `assignClassTeacher` (SectionModel). Clients
  // get the updated link state in the same response without a follow-up
  // fetch — matches the pattern other domain mutations use.
  @Mutation(() => SubjectModel, {
    description:
      'Link the subject to a standard (idempotent). Returns the subject for cache-update parity.',
  })
  @CheckAbility('update', 'Subject')
  async assignSubjectToStandard(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('standardId', { type: () => ID }) standardId: string,
  ): Promise<SubjectRecord> {
    await this.subjectService.assignToStandard(subjectId, standardId);
    return this.subjectService.findById(subjectId);
  }

  @Mutation(() => SubjectModel, {
    description: 'Remove the subject from a standard (idempotent). Returns the subject.',
  })
  @CheckAbility('update', 'Subject')
  async removeSubjectFromStandard(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('standardId', { type: () => ID }) standardId: string,
  ): Promise<SubjectRecord> {
    await this.subjectService.removeFromStandard(subjectId, standardId);
    return this.subjectService.findById(subjectId);
  }

  @Mutation(() => SubjectModel, {
    description:
      'Link the subject to a section (idempotent). Returns the subject for cache-update parity.',
  })
  @CheckAbility('update', 'Subject')
  async assignSubjectToSection(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('sectionId', { type: () => ID }) sectionId: string,
  ): Promise<SubjectRecord> {
    await this.subjectService.assignToSection(subjectId, sectionId);
    return this.subjectService.findById(subjectId);
  }

  @Mutation(() => SubjectModel, {
    description: 'Remove the subject from a section (idempotent). Returns the subject.',
  })
  @CheckAbility('update', 'Subject')
  async removeSubjectFromSection(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('sectionId', { type: () => ID }) sectionId: string,
  ): Promise<SubjectRecord> {
    await this.subjectService.removeFromSection(subjectId, sectionId);
    return this.subjectService.findById(subjectId);
  }
}
