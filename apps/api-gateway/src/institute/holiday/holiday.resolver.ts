import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import { HolidayType } from '@roviq/common-types';
import { CreateHolidayInput } from './dto/create-holiday.input';
import { UpdateHolidayInput } from './dto/update-holiday.input';
import { HolidayService } from './holiday.service';
import { HolidayModel } from './models/holiday.model';
import type { HolidayRecord } from './repositories/types';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => HolidayModel)
export class HolidayResolver {
  constructor(private readonly service: HolidayService) {}

  @Query(() => [HolidayModel], {
    description:
      'List holidays, ordered by `startDate` ASC (calendar order — clients render upcoming first). Optional filters narrow by type, overlapping date range, or visibility.',
  })
  @CheckAbility('read', 'Holiday')
  async holidays(
    @Args('type', { type: () => HolidayType, nullable: true }) type: HolidayType | null,
    @Args('startDate', { type: () => String, nullable: true }) startDate: string | null,
    @Args('endDate', { type: () => String, nullable: true }) endDate: string | null,
    @Args('isPublic', { type: () => Boolean, nullable: true }) isPublic: boolean | null,
  ): Promise<HolidayRecord[]> {
    return this.service.list({
      type: type ?? undefined,
      startDate: startDate ?? undefined,
      endDate: endDate ?? undefined,
      isPublic: isPublic ?? undefined,
    });
  }

  @Query(() => HolidayModel)
  @CheckAbility('read', 'Holiday')
  async holiday(@Args('id', { type: () => ID }) id: string): Promise<HolidayRecord> {
    return this.service.findById(id);
  }

  @Query(() => [HolidayModel], {
    description: 'Return every holiday whose inclusive range contains the given date.',
  })
  @CheckAbility('read', 'Holiday')
  async holidaysOnDate(
    @Args('date', { type: () => String, description: 'ISO YYYY-MM-DD date to look up.' })
    date: string,
  ): Promise<HolidayRecord[]> {
    return this.service.onDate(date);
  }

  @Mutation(() => HolidayModel, { description: 'Publish a new holiday or break.' })
  @CheckAbility('create', 'Holiday')
  async createHoliday(@Args('input') input: CreateHolidayInput): Promise<HolidayRecord> {
    return this.service.create(input);
  }

  @Mutation(() => HolidayModel, { description: 'Edit an existing holiday.' })
  @CheckAbility('update', 'Holiday')
  async updateHoliday(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateHolidayInput,
  ): Promise<HolidayRecord> {
    return this.service.update(id, input);
  }

  @Mutation(() => Boolean, { description: 'Soft-delete a holiday.' })
  @CheckAbility('delete', 'Holiday')
  async deleteHoliday(@Args('id', { type: () => ID }) id: string): Promise<boolean> {
    return this.service.delete(id);
  }
}
