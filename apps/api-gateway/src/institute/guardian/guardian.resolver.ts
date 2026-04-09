import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { CreateGuardianInput } from './dto/create-guardian.input';
import {
  LinkGuardianInput,
  RevokeGuardianAccessInput,
  UnlinkGuardianInput,
} from './dto/link-guardian.input';
import { ListGuardiansFilterInput } from './dto/list-guardians-filter.input';
import { UpdateGuardianInput } from './dto/update-guardian.input';
import { GuardianService } from './guardian.service';
import {
  GuardianLinkedStudentModel,
  GuardianLinkModel,
  GuardianModel,
  StudentGuardianModel,
} from './models/guardian.model';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => GuardianModel)
export class GuardianResolver {
  constructor(private readonly guardianService: GuardianService) {}

  @Query(() => [GuardianModel], {
    description: 'List all guardians in this institute, with optional free-text search',
  })
  @CheckAbility('read', 'Guardian')
  async listGuardians(
    @Args('filter', { nullable: true }) filter?: ListGuardiansFilterInput,
  ): Promise<GuardianModel[]> {
    return this.guardianService.list(filter) as Promise<GuardianModel[]>;
  }

  @Query(() => [GuardianLinkedStudentModel], {
    description:
      'List students linked to a single guardian, with resolved class/section + link metadata. Used by the Linked Children tab on the guardian detail page.',
  })
  @CheckAbility('read', 'Guardian')
  async listLinkedStudents(
    @Args('guardianProfileId', { type: () => ID }) guardianProfileId: string,
  ): Promise<GuardianLinkedStudentModel[]> {
    return this.guardianService.listLinkedStudents(guardianProfileId) as Promise<
      GuardianLinkedStudentModel[]
    >;
  }

  @Query(() => [StudentGuardianModel], {
    description:
      'List guardians linked to a single student, with relationship and contact metadata. Used by the Guardians tab on the student detail page.',
  })
  @CheckAbility('read', 'Guardian')
  async listStudentGuardians(
    @Args('studentProfileId', { type: () => ID }) studentProfileId: string,
  ): Promise<StudentGuardianModel[]> {
    return this.guardianService.listForStudent(studentProfileId) as Promise<StudentGuardianModel[]>;
  }

  @Query(() => GuardianModel, { description: 'Get a guardian by ID' })
  @CheckAbility('read', 'Guardian')
  async getGuardian(@Args('id', { type: () => ID }) id: string): Promise<GuardianModel> {
    return this.guardianService.findById(id) as Promise<GuardianModel>;
  }

  @Mutation(() => GuardianModel, { description: 'Create guardian, optionally link to a student' })
  @CheckAbility('create', 'Guardian')
  async createGuardian(@Args('input') input: CreateGuardianInput): Promise<GuardianModel> {
    return this.guardianService.create(input) as Promise<GuardianModel>;
  }

  @Mutation(() => GuardianModel, { description: 'Update guardian with optimistic concurrency' })
  @CheckAbility('update', 'Guardian')
  async updateGuardian(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateGuardianInput,
  ): Promise<GuardianModel> {
    return this.guardianService.update(id, input) as Promise<GuardianModel>;
  }

  @Mutation(() => Boolean, { description: 'Soft-delete a guardian' })
  @CheckAbility('delete', 'Guardian')
  async deleteGuardian(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.guardianService.delete(id);
  }

  @Mutation(() => GuardianLinkModel, { description: 'Link a guardian to a student' })
  @CheckAbility('create', 'Guardian')
  async linkGuardianToStudent(@Args('input') input: LinkGuardianInput): Promise<GuardianLinkModel> {
    return this.guardianService.linkToStudent(input) as Promise<GuardianLinkModel>;
  }

  @Mutation(() => Boolean, {
    description: 'Unlink a guardian from a student. If primary, must provide newPrimaryGuardianId',
  })
  @CheckAbility('delete', 'Guardian')
  async unlinkGuardianFromStudent(@Args('input') input: UnlinkGuardianInput): Promise<boolean> {
    return this.guardianService.unlinkFromStudent(input);
  }

  @Mutation(() => GuardianLinkModel, {
    description:
      'Revoke guardian access (divorce/separation). Sets can_pickup=false, preserves link for TC history.',
  })
  @CheckAbility('manage', 'Guardian')
  async revokeGuardianAccess(
    @Args('input') input: RevokeGuardianAccessInput,
  ): Promise<GuardianLinkModel> {
    return this.guardianService.revokeAccess(input) as Promise<GuardianLinkModel>;
  }
}
