import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InstituteScope } from '@roviq/auth-backend';
import { CheckAbility } from '@roviq/casl';
import { AcademicYearService } from './academic-year.service';
import { CreateAcademicYearInput } from './dto/create-academic-year.input';
import { UpdateAcademicYearInput } from './dto/update-academic-year.input';
import { AcademicYearModel } from './models/academic-year.model';

@InstituteScope()
@Resolver(() => AcademicYearModel)
export class AcademicYearResolver {
  constructor(private readonly academicYearService: AcademicYearService) {}

  @Query(() => [AcademicYearModel])
  @CheckAbility('read', 'AcademicYear')
  async academicYears(): Promise<AcademicYearModel[]> {
    return this.academicYearService.findAll();
  }

  @Query(() => AcademicYearModel)
  @CheckAbility('read', 'AcademicYear')
  async academicYear(@Args('id', { type: () => ID }) id: string): Promise<AcademicYearModel> {
    return this.academicYearService.findById(id);
  }

  @Query(() => AcademicYearModel, { nullable: true })
  @CheckAbility('read', 'AcademicYear')
  async activeAcademicYear(): Promise<AcademicYearModel | null> {
    return this.academicYearService.findActive();
  }

  @Mutation(() => AcademicYearModel)
  @CheckAbility('create', 'AcademicYear')
  async createAcademicYear(
    @Args('input') input: CreateAcademicYearInput,
  ): Promise<AcademicYearModel> {
    return this.academicYearService.create(input);
  }

  @Mutation(() => AcademicYearModel)
  @CheckAbility('update', 'AcademicYear')
  async updateAcademicYear(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAcademicYearInput,
  ): Promise<AcademicYearModel> {
    return this.academicYearService.update(id, input);
  }

  @Mutation(() => AcademicYearModel)
  @CheckAbility('update', 'AcademicYear')
  async activateAcademicYear(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AcademicYearModel> {
    return this.academicYearService.activate(id);
  }

  @Mutation(() => AcademicYearModel)
  @CheckAbility('update', 'AcademicYear')
  async archiveAcademicYear(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<AcademicYearModel> {
    return this.academicYearService.archive(id);
  }
}
