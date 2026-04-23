import type {
  CreateLeaveData,
  LeaveListQuery,
  LeaveOnDateQuery,
  LeaveRecord,
  UpdateLeaveData,
} from './types';

export abstract class LeaveRepository {
  abstract findById(id: string): Promise<LeaveRecord | null>;
  abstract list(query: LeaveListQuery): Promise<LeaveRecord[]>;
  abstract create(data: CreateLeaveData): Promise<LeaveRecord>;
  abstract update(id: string, data: UpdateLeaveData): Promise<LeaveRecord>;
  abstract setStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED' | 'CANCELLED',
    decidedBy: string,
  ): Promise<LeaveRecord>;
  abstract softDelete(id: string): Promise<void>;

  /**
   * Returns the membership ids (subset of `userIds`) that have an APPROVED
   * leave whose inclusive range contains `date`. Used by attendance to seed
   * LEAVE entries on session open.
   */
  abstract approvedOnDate(query: LeaveOnDateQuery): Promise<string[]>;
}
