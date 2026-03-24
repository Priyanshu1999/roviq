import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { CreateSectionInput } from './dto/create-section.input';
import { UpdateSectionInput } from './dto/update-section.input';
import { SectionModel } from './models/section.model';
import type { SectionRecord } from './repositories/types';
import { SectionService } from './section.service';

@InstituteScope()
@UseGuards(AbilityGuard)
@Resolver(() => SectionModel)
export class SectionResolver {
  constructor(private readonly sectionService: SectionService) {}

  @Query(() => [SectionModel])
  @CheckAbility('read', 'Section')
  async sections(
    @Args('standardId', { type: () => ID }) standardId: string,
  ): Promise<SectionRecord[]> {
    return this.sectionService.findByStandard(standardId);
  }

  @Query(() => SectionModel)
  @CheckAbility('read', 'Section')
  async section(@Args('id', { type: () => ID }) id: string): Promise<SectionRecord> {
    return this.sectionService.findById(id);
  }

  @Mutation(() => SectionModel)
  @CheckAbility('create', 'Section')
  async createSection(@Args('input') input: CreateSectionInput): Promise<SectionRecord> {
    return this.sectionService.create(input);
  }

  @Mutation(() => SectionModel)
  @CheckAbility('update', 'Section')
  async updateSection(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSectionInput,
  ): Promise<SectionRecord> {
    return this.sectionService.update(id, input);
  }

  @Mutation(() => SectionModel)
  @CheckAbility('update', 'Section')
  async assignClassTeacher(
    @Args('sectionId', { type: () => ID }) sectionId: string,
    @Args('classTeacherId', { type: () => ID }) classTeacherId: string,
  ): Promise<SectionRecord> {
    return this.sectionService.assignClassTeacher(sectionId, classTeacherId);
  }

  @Mutation(() => Boolean)
  @CheckAbility('delete', 'Section')
  async deleteSection(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.sectionService.delete(id);
  }
}
