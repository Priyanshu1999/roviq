import { Module } from '@nestjs/common';

@Module({
  imports: [
    // Reseller-scoped feature modules will be added here (ROV-94+)
    // Resolvers in this group use @ResellerScope() decorator
  ],
})
export class ResellerModule {}
