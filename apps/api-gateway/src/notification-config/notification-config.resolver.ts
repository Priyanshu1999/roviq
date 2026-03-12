import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '@roviq/common-types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { UpdateNotificationConfigInput } from './dto/update-notification-config.input';
import { NotificationConfigModel } from './models/notification-config.model';
import { NotificationConfigService } from './notification-config.service';

@Resolver()
export class NotificationConfigResolver {
  constructor(private readonly notificationConfigService: NotificationConfigService) {}

  @Query(() => [NotificationConfigModel])
  @UseGuards(GqlAuthGuard)
  async notificationConfigs(): Promise<NotificationConfigModel[]> {
    return this.notificationConfigService.findAll();
  }

  @Mutation(() => NotificationConfigModel)
  @UseGuards(GqlAuthGuard)
  async updateNotificationConfig(
    @Args('input') input: UpdateNotificationConfigInput,
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationConfigModel> {
    return this.notificationConfigService.update(user.tenantId, input);
  }
}
