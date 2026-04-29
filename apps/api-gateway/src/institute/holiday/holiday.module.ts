import { Module } from '@nestjs/common';
import { HolidayResolver } from './holiday.resolver';
import { HolidayService } from './holiday.service';
import { HolidayRepositoryModule } from './repositories/holiday-repository.module';

@Module({
  imports: [HolidayRepositoryModule],
  providers: [HolidayService, HolidayResolver],
  exports: [HolidayService],
})
export class HolidayModule {}
