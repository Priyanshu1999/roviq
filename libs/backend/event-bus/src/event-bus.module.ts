import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';

// Imported once at the app root — feature modules can then inject
// `EventBusService` without importing this module explicitly.
@Global()
@Module({
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
