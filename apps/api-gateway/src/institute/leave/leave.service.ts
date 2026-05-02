import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  calendarDaysBetween,
  isValidDateRange,
  LEAVE_STATE_MACHINE,
  LeaveStatus,
  type LeaveType,
} from '@roviq/common-types';
import { EVENT_PATTERNS } from '@roviq/nats-jetstream';
import { getRequestContext } from '@roviq/request-context';
import { EventBusService } from '../../common/event-bus.service';
import type { CreateLeaveInput } from './dto/create-leave.input';
import type { UpdateLeaveInput } from './dto/update-leave.input';
import { LeaveRepository } from './repositories/leave.repository';
import type { LeaveRecord } from './repositories/types';

const MIN_DOCUMENTED_DAYS = 3;

@Injectable()
export class LeaveService {
  constructor(
    private readonly repo: LeaveRepository,
    private readonly eventBus: EventBusService,
  ) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  async findById(id: string): Promise<LeaveRecord> {
    const record = await this.repo.findById(id);
    if (!record) throw new NotFoundException(`Leave ${id} not found`);
    return record;
  }

  async list(filter: {
    userId?: string;
    status?: LeaveStatus;
    type?: LeaveType;
    startDate?: string;
    endDate?: string;
  }): Promise<LeaveRecord[]> {
    return this.repo.list(filter);
  }

  async apply(input: CreateLeaveInput): Promise<LeaveRecord> {
    this.assertValidRange(input.startDate, input.endDate);
    const files = input.fileUrls ?? [];
    if (
      calendarDaysBetween(input.startDate, input.endDate) >= MIN_DOCUMENTED_DAYS &&
      files.length === 0
    ) {
      throw new BadRequestException(
        'Leaves spanning 3 or more calendar days require at least one supporting document.',
      );
    }

    const record = await this.repo.create({
      userId: input.userId,
      startDate: input.startDate,
      endDate: input.endDate,
      type: input.type,
      reason: input.reason,
      fileUrls: files,
    });

    this.eventBus.emit(EVENT_PATTERNS.LEAVE.applied, {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      startDate: record.startDate,
      endDate: record.endDate,
      type: record.type,
    });

    return record;
  }

  async update(id: string, input: UpdateLeaveInput): Promise<LeaveRecord> {
    const existing = await this.findById(id);
    if (existing.status !== LeaveStatus.PENDING) {
      // Deliberately strict: approvals are audited decisions. To amend an
      // already-decided leave the applicant must cancel and re-apply.
      throw new BadRequestException('Only PENDING leaves can be edited.');
    }
    const start = input.startDate ?? existing.startDate;
    const end = input.endDate ?? existing.endDate;
    this.assertValidRange(start, end);

    const record = await this.repo.update(id, input);
    this.eventBus.emit(EVENT_PATTERNS.LEAVE.updated, {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
    });
    return record;
  }

  async approve(id: string, approverMembershipId: string): Promise<LeaveRecord> {
    const existing = await this.findById(id);
    LEAVE_STATE_MACHINE.assertTransition(existing.status, LeaveStatus.APPROVED);
    const record = await this.repo.setStatus(id, LeaveStatus.APPROVED, approverMembershipId);
    this.eventBus.emit(EVENT_PATTERNS.LEAVE.approved, {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      approverMembershipId,
    });
    // Notification-service listens for this and pings the applicant + parents.
    this.eventBus.emit(EVENT_PATTERNS.NOTIFICATION.LEAVE_DECIDED, {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      status: LeaveStatus.APPROVED,
    });
    return record;
  }

  async reject(id: string, approverMembershipId: string): Promise<LeaveRecord> {
    const existing = await this.findById(id);
    LEAVE_STATE_MACHINE.assertTransition(existing.status, LeaveStatus.REJECTED);
    const record = await this.repo.setStatus(id, LeaveStatus.REJECTED, approverMembershipId);
    this.eventBus.emit(EVENT_PATTERNS.LEAVE.rejected, {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      approverMembershipId,
    });
    this.eventBus.emit(EVENT_PATTERNS.NOTIFICATION.LEAVE_DECIDED, {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      status: LeaveStatus.REJECTED,
    });
    return record;
  }

  async cancel(id: string, cancellerMembershipId: string): Promise<LeaveRecord> {
    const existing = await this.findById(id);
    LEAVE_STATE_MACHINE.assertTransition(existing.status, LeaveStatus.CANCELLED);
    const record = await this.repo.setStatus(id, LeaveStatus.CANCELLED, cancellerMembershipId);
    this.eventBus.emit(EVENT_PATTERNS.LEAVE.cancelled, {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
    });
    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);
    this.eventBus.emit(EVENT_PATTERNS.LEAVE.deleted, { leaveId: id, tenantId: this.tenantId });
    return true;
  }

  /**
   * Used by the attendance module when opening a session: returns the subset
   * of the given student membership ids that have an APPROVED leave covering
   * `date`. Attendance seeds those students as LEAVE instead of PRESENT.
   */
  async approvedOnDate(date: string, userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    return this.repo.approvedOnDate({ date, userIds });
  }

  private assertValidRange(start: string, end: string) {
    if (!isValidDateRange(start, end)) {
      throw new BadRequestException('Leave end date must not be before the start date.');
    }
  }
}
