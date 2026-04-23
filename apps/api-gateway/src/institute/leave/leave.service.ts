import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { LeaveStatus, LeaveType } from '@roviq/common-types';
import type { CreateLeaveInput } from './dto/create-leave.input';
import type { UpdateLeaveInput } from './dto/update-leave.input';
import { LeaveRepository } from './repositories/leave.repository';
import type { LeaveRecord } from './repositories/types';

/**
 * Number of whole-day difference between start and end above which a
 * supporting document (e.g., medical certificate) is required. 2 = a
 * 3-day or longer leave needs at least one fileUrl.
 */
const MAX_UNDOCUMENTED_DAYS = 2;

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly repo: LeaveRepository,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

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
      this.diffDays(input.startDate, input.endDate) > MAX_UNDOCUMENTED_DAYS &&
      files.length === 0
    ) {
      throw new BadRequestException(
        'Leaves longer than two days require at least one supporting document.',
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

    this.emitEvent('LEAVE.applied', {
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
    if (existing.status !== 'PENDING') {
      // Deliberately strict: approvals are audited decisions. To amend an
      // already-decided leave the applicant must cancel and re-apply.
      throw new BadRequestException('Only PENDING leaves can be edited.');
    }
    const start = input.startDate ?? existing.startDate;
    const end = input.endDate ?? existing.endDate;
    this.assertValidRange(start, end);

    const record = await this.repo.update(id, input);
    this.emitEvent('LEAVE.updated', {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
    });
    return record;
  }

  async approve(id: string, approverMembershipId: string): Promise<LeaveRecord> {
    const record = await this.repo.setStatus(id, 'APPROVED', approverMembershipId);
    this.emitEvent('LEAVE.approved', {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      approverMembershipId,
    });
    // Notification-service listens for this and pings the applicant + parents.
    this.emitEvent('NOTIFICATION.leave.decided', {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      status: 'APPROVED',
    });
    return record;
  }

  async reject(id: string, approverMembershipId: string): Promise<LeaveRecord> {
    const record = await this.repo.setStatus(id, 'REJECTED', approverMembershipId);
    this.emitEvent('LEAVE.rejected', {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      approverMembershipId,
    });
    this.emitEvent('NOTIFICATION.leave.decided', {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
      status: 'REJECTED',
    });
    return record;
  }

  async cancel(id: string, cancellerMembershipId: string): Promise<LeaveRecord> {
    const record = await this.repo.setStatus(id, 'CANCELLED', cancellerMembershipId);
    this.emitEvent('LEAVE.cancelled', {
      leaveId: record.id,
      tenantId: record.tenantId,
      userId: record.userId,
    });
    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.repo.softDelete(id);
    this.emitEvent('LEAVE.deleted', { leaveId: id });
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

  private diffDays(startISO: string, endISO: string): number {
    const start = Date.parse(`${startISO}T00:00:00Z`);
    const end = Date.parse(`${endISO}T00:00:00Z`);
    return Math.round((end - start) / 86_400_000);
  }

  private assertValidRange(start: string, end: string) {
    if (this.diffDays(start, end) < 0) {
      throw new BadRequestException('Leave end date must not be before the start date.');
    }
  }

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }
}
