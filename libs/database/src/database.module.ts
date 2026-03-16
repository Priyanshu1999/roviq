import { Global, Module } from '@nestjs/common';
import { drizzleProviders } from './providers';

@Global()
@Module({
  providers: [...drizzleProviders],
  exports: [...drizzleProviders],
})
export class DatabaseModule {}
