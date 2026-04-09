import { ForbiddenException, Injectable } from '@nestjs/common';
import { BusinessException, ErrorCode } from '@roviq/common-types';
import { getRequestContext } from '@roviq/request-context';
import { EventBusService } from '../../common/event-bus.service';
import { encodeCursor } from '../../common/pagination/relay-pagination.model';
import { InstituteRepository } from '../../institute/management/repositories/institute.repository';
import type { ResellerCreateInstituteRequestInput } from './dto/reseller-create-institute-request.input';

@Injectable()
export class ResellerInstituteService {
  constructor(
    private readonly instituteRepo: InstituteRepository,
    private readonly eventBus: EventBusService,
  ) {}

  private getResellerId(): string {
    const { resellerId } = getRequestContext();
    if (!resellerId) throw new ForbiddenException('Reseller scope required');
    return resellerId;
  }

  /** Create institute request with status=pending_approval. Does NOT trigger Temporal. */
  async createRequest(input: ResellerCreateInstituteRequestInput) {
    const { userId } = getRequestContext();
    const resellerId = this.getResellerId();

    // Create via repository with reseller auto-assigned
    const record = await this.instituteRepo.create({
      ...input,
      resellerId,
      isDemo: false,
    });

    // Override status to PENDING_APPROVAL (repo defaults to ACTIVE)
    await this.instituteRepo.updateStatus(record.id, 'PENDING_APPROVAL');

    this.eventBus.emit('INSTITUTE.approval_requested', {
      instituteId: record.id,
      resellerId,
      requestedBy: userId,
    });

    return { ...record, status: 'PENDING_APPROVAL' };
  }

  /** List institutes scoped to reseller via RLS */
  async list(filter: {
    search?: string;
    status?: string;
    type?: string;
    first?: number;
    after?: string;
  }) {
    const resellerId = this.getResellerId();
    const limit = filter.first ?? 20;

    const { records, total } = await this.instituteRepo.searchByReseller(resellerId, {
      search: filter.search,
      status: filter.status,
      type: filter.type,
      first: limit + 1,
      after: filter.after,
    });

    const hasNextPage = records.length > limit;
    const nodes = hasNextPage ? records.slice(0, limit) : records;
    const edges = nodes.map((record) => ({
      node: record,
      cursor: encodeCursor({ id: record.id }),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!filter.after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount: total,
    };
  }

  /** Get institute by ID, scoped to reseller */
  async findById(id: string) {
    const resellerId = this.getResellerId();
    const record = await this.instituteRepo.findByReseller(resellerId, id);
    if (!record) {
      throw new BusinessException(ErrorCode.INSTITUTE_NOT_FOUND, `Institute ${id} not found`);
    }
    return record;
  }

  /** Suspend an active institute — full_management tier only */
  async suspend(id: string, reason?: string) {
    const institute = await this.findById(id);
    if (institute.status !== 'ACTIVE') {
      throw new BusinessException(
        ErrorCode.SETUP_NOT_COMPLETE,
        `Cannot suspend: status is ${institute.status}, must be ACTIVE`,
      );
    }

    const record = await this.instituteRepo.updateStatus(id, 'SUSPENDED');

    this.eventBus.emit('INSTITUTE.suspended', {
      instituteId: id,
      resellerId: this.getResellerId(),
      previousStatus: 'ACTIVE',
      reason,
      scope: 'reseller',
    });

    return record;
  }

  /** Reactivate a suspended institute — full_management tier only */
  async reactivate(id: string) {
    const institute = await this.findById(id);
    if (institute.status !== 'SUSPENDED') {
      throw new BusinessException(
        ErrorCode.SETUP_NOT_COMPLETE,
        `Cannot reactivate: status is ${institute.status}, must be SUSPENDED`,
      );
    }

    const record = await this.instituteRepo.updateStatus(id, 'ACTIVE');

    this.eventBus.emit('INSTITUTE.activated', {
      instituteId: id,
      resellerId: this.getResellerId(),
      previousStatus: 'SUSPENDED',
      scope: 'reseller',
    });

    return record;
  }

  /** Aggregate stats across reseller's institutes */
  async getStatistics() {
    const resellerId = this.getResellerId();
    return this.instituteRepo.statisticsByReseller(resellerId);
  }
}
