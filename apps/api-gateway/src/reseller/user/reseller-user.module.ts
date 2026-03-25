import { Module } from '@nestjs/common';
import { ResellerUserResolver } from './reseller-user.resolver';
import { ResellerUserService } from './reseller-user.service';

@Module({
  providers: [ResellerUserService, ResellerUserResolver],
})
export class ResellerUserModule {}
