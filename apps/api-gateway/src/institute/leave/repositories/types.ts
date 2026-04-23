import type { LeaveStatus, LeaveType } from '@roviq/common-types';

export interface LeaveRecord {
  id: string;
  tenantId: string;
  userId: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  reason: string;
  status: LeaveStatus;
  fileUrls: string[];
  decidedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeaveData {
  userId: string;
  startDate: string;
  endDate: string;
  type: LeaveType;
  reason: string;
  fileUrls?: string[];
}

export interface UpdateLeaveData {
  startDate?: string;
  endDate?: string;
  type?: LeaveType;
  reason?: string;
  fileUrls?: string[];
}

export interface LeaveListQuery {
  userId?: string;
  status?: LeaveStatus;
  type?: LeaveType;
  startDate?: string;
  endDate?: string;
}

export interface LeaveOnDateQuery {
  date: string;
  userIds: string[];
}
