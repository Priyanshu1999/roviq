import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, InstituteScope } from '@roviq/auth-backend';
import type { AuthUser } from '@roviq/common-types';
import { UpdateNotificationConfigInput } from './dto/update-notification-config.input';
import { NotificationConfigModel } from './models/notification-config.model';
import { NotificationConfigService } from './notification-config.service';

@InstituteScope()
@Resolver()
export class NotificationConfigResolver {
  constructor(private readonly notificationConfigService: NotificationConfigService) {}

  @Query(() => [NotificationConfigModel])
  async notificationConfigs(): Promise<NotificationConfigModel[]> {
    return this.notificationConfigService.findAll();
  }

  @Mutation(() => NotificationConfigModel)
  async updateNotificationConfig(
    @Args('input') input: UpdateNotificationConfigInput,
    @CurrentUser() user: AuthUser,
  ): Promise<NotificationConfigModel> {
    if (!user.tenantId) {
      throw new Error('Institute scope required to update notification config');
    }
    return this.notificationConfigService.update(user.tenantId, input);
  }

  @Mutation(() => Boolean)
  async registerDeviceToken(
    @Args('token') token: string,
    @CurrentUser() user: AuthUser,
  ): Promise<boolean> {
    return this.notificationConfigService.registerDeviceToken(user.userId, token);
  }
}
