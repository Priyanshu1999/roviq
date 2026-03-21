import { Module } from '@nestjs/common';

@Module({
  imports: [
    // Admin-scoped feature modules will be added here (ROV-94+)
    // Resolvers in this group use @PlatformScope() decorator
  ],
})
export class AdminModule {}
