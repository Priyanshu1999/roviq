import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CreateSectionInput } from './dto/create-section.input';
import { UpdateSectionInput } from './dto/update-section.input';
import { SectionModel } from './models/section.model';
import { SectionService } from './section.service';

@Resolver(() => SectionModel)
export class SectionResolver {
  constructor(private readonly sectionService: SectionService) {}

  @Query(() => [SectionModel])
  @UseGuards(GqlAuthGuard)
  async sections(
    @Args('standardId', { type: () => ID }) standardId: string,
  ): Promise<SectionModel[]> {
    return this.sectionService.findByStandard(standardId);
  }

  @Query(() => SectionModel)
  @UseGuards(GqlAuthGuard)
  async section(@Args('id', { type: () => ID }) id: string): Promise<SectionModel> {
    return this.sectionService.findById(id);
  }

  @Mutation(() => SectionModel)
  @UseGuards(GqlAuthGuard)
  async createSection(@Args('input') input: CreateSectionInput): Promise<SectionModel> {
    return this.sectionService.create(input);
  }

  @Mutation(() => SectionModel)
  @UseGuards(GqlAuthGuard)
  async updateSection(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSectionInput,
  ): Promise<SectionModel> {
    return this.sectionService.update(id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteSection(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.sectionService.delete(id);
  }
}
