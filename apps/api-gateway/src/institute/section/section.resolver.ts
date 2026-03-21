import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { CheckAbility } from '@roviq/casl';
import { CreateSectionInput } from './dto/create-section.input';
import { UpdateSectionInput } from './dto/update-section.input';
import { SectionModel } from './models/section.model';
import { SectionService } from './section.service';

@InstituteScope()
@Resolver(() => SectionModel)
export class SectionResolver {
  constructor(private readonly sectionService: SectionService) {}

  @Query(() => [SectionModel])
  @CheckAbility('read', 'Section')
  async sections(
    @Args('standardId', { type: () => ID }) standardId: string,
  ): Promise<SectionModel[]> {
    return this.sectionService.findByStandard(standardId);
  }

  @Query(() => SectionModel)
  @CheckAbility('read', 'Section')
  async section(@Args('id', { type: () => ID }) id: string): Promise<SectionModel> {
    return this.sectionService.findById(id);
  }

  @Mutation(() => SectionModel)
  @CheckAbility('create', 'Section')
  async createSection(@Args('input') input: CreateSectionInput): Promise<SectionModel> {
    return this.sectionService.create(input);
  }

  @Mutation(() => SectionModel)
  @CheckAbility('update', 'Section')
  async updateSection(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSectionInput,
  ): Promise<SectionModel> {
    return this.sectionService.update(id, input);
  }

  @Mutation(() => Boolean)
  @CheckAbility('delete', 'Section')
  async deleteSection(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.sectionService.delete(id);
  }
}
