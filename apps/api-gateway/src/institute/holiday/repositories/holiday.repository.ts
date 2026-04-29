import type {
  CreateHolidayData,
  HolidayListQuery,
  HolidayOnDateQuery,
  HolidayRecord,
  UpdateHolidayData,
} from './types';

export abstract class HolidayRepository {
  abstract findById(id: string): Promise<HolidayRecord | null>;
  abstract list(query: HolidayListQuery): Promise<HolidayRecord[]>;
  abstract create(data: CreateHolidayData): Promise<HolidayRecord>;
  abstract update(id: string, data: UpdateHolidayData): Promise<HolidayRecord>;
  abstract softDelete(id: string): Promise<void>;

  /**
   * Returns every holiday whose inclusive range contains `date`. Used by the
   * attendance module at session-open time to refuse creating classes on a
   * declared holiday.
   */
  abstract onDate(query: HolidayOnDateQuery): Promise<HolidayRecord[]>;
}
