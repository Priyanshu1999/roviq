import type { HolidayType } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';

export interface HolidayRecord {
  id: string;
  tenantId: string;
  name: I18nContent;
  description: string | null;
  type: HolidayType;
  startDate: string;
  endDate: string;
  tags: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateHolidayData {
  name: I18nContent;
  description?: string | null;
  type: HolidayType;
  startDate: string;
  endDate: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdateHolidayData {
  name?: I18nContent;
  description?: string | null;
  type?: HolidayType;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface HolidayListQuery {
  type?: HolidayType;
  startDate?: string;
  endDate?: string;
  isPublic?: boolean;
}

export interface HolidayOnDateQuery {
  date: string;
}
