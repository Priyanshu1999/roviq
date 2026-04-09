import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, GqlAuthGuard, InstituteScopeGuard } from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { BotService } from './bot.service';
import { CreateBotInput } from './dto/create-bot.input';
import { UpdateBotInput } from './dto/update-bot.input';
import { BotModel } from './models/bot.model';
import { CreateBotResponse } from './models/create-bot-response.model';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver(() => BotModel)
export class BotResolver {
  constructor(private readonly botService: BotService) {}

  @Mutation(() => CreateBotResponse)
  @CheckAbility('create', 'Bot')
  async createBot(
    @Args('input') input: CreateBotInput,
    @CurrentUser() user: AuthUser,
  ): Promise<CreateBotResponse> {
    if (!user.tenantId) throw new Error('Institute scope required');
    return this.botService.createBot(user.tenantId, input, user.userId);
  }

  @Mutation(() => CreateBotResponse)
  @CheckAbility('update', 'Bot')
  async rotateBotApiKey(
    @Args('botId', { type: () => ID }) botId: string,
  ): Promise<CreateBotResponse> {
    return this.botService.rotateBotApiKey(botId);
  }

  @Query(() => [BotModel])
  @CheckAbility('read', 'Bot')
  async listBots(): Promise<BotModel[]> {
    return this.botService.listBots();
  }

  @Mutation(() => BotModel)
  @CheckAbility('update', 'Bot')
  async updateBot(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateBotInput,
  ): Promise<BotModel> {
    return this.botService.updateBot(id, input);
  }

  @Mutation(() => Boolean)
  @CheckAbility('delete', 'Bot')
  async deleteBot(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<boolean> {
    if (!user.tenantId) throw new Error('Institute scope required');
    return this.botService.deleteBot(id, user.tenantId);
  }
}
