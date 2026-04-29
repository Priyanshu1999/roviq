import { Module } from '@nestjs/common';
import { HolidayDrizzleRepository } from './holiday.drizzle-repository';
import { HolidayRepository } from './holiday.repository';

@Module({
  providers: [{ provide: HolidayRepository, useClass: HolidayDrizzleRepository }],
  exports: [HolidayRepository],
})
export class HolidayRepositoryModule {}
