import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CheckAbility, GqlAuthGuard } from '@roviq/casl';
import { CreateSubjectInput } from './dto/create-subject.input';
import { UpdateSubjectInput } from './dto/update-subject.input';
import { SubjectModel } from './models/subject.model';
import { SubjectService } from './subject.service';

@Resolver(() => SubjectModel)
export class SubjectResolver {
  constructor(private readonly subjectService: SubjectService) {}

  @Query(() => [SubjectModel])
  @UseGuards(GqlAuthGuard)
  @CheckAbility('read', 'Subject')
  async subjects(): Promise<SubjectModel[]> {
    return this.subjectService.findAll();
  }

  @Query(() => SubjectModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('read', 'Subject')
  async subject(@Args('id', { type: () => ID }) id: string): Promise<SubjectModel> {
    return this.subjectService.findById(id);
  }

  @Query(() => [SubjectModel])
  @UseGuards(GqlAuthGuard)
  @CheckAbility('read', 'Subject')
  async subjectsByStandard(
    @Args('standardId', { type: () => ID }) standardId: string,
  ): Promise<SubjectModel[]> {
    return this.subjectService.findByStandard(standardId);
  }

  @Mutation(() => SubjectModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('create', 'Subject')
  async createSubject(@Args('input') input: CreateSubjectInput): Promise<SubjectModel> {
    return this.subjectService.create(input);
  }

  @Mutation(() => SubjectModel)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Subject')
  async updateSubject(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSubjectInput,
  ): Promise<SubjectModel> {
    return this.subjectService.update(id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('delete', 'Subject')
  async deleteSubject(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.subjectService.delete(id);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Subject')
  async assignSubjectToStandard(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('standardId', { type: () => ID }) standardId: string,
  ): Promise<boolean> {
    return this.subjectService.assignToStandard(subjectId, standardId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Subject')
  async removeSubjectFromStandard(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('standardId', { type: () => ID }) standardId: string,
  ): Promise<boolean> {
    return this.subjectService.removeFromStandard(subjectId, standardId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Subject')
  async assignSubjectToSection(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('sectionId', { type: () => ID }) sectionId: string,
  ): Promise<boolean> {
    return this.subjectService.assignToSection(subjectId, sectionId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @CheckAbility('update', 'Subject')
  async removeSubjectFromSection(
    @Args('subjectId', { type: () => ID }) subjectId: string,
    @Args('sectionId', { type: () => ID }) sectionId: string,
  ): Promise<boolean> {
    return this.subjectService.removeFromSection(subjectId, sectionId);
  }
}
