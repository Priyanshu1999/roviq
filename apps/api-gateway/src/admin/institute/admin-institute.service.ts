import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException, ErrorCode, getRequestContext } from '@roviq/common-types';
import { Client, Connection } from '@temporalio/client';
import { EventBusService } from '../../common/event-bus.service';
import { encodeCursor } from '../../common/pagination/relay-pagination.model';
import { InstituteService } from '../../institute/management/institute.service';
import { InstituteRepository } from '../../institute/management/repositories/institute.repository';
import type { InstituteRecord } from '../../institute/management/repositories/types';
import type { AdminListInstitutesFilterInput } from './dto/admin-list-institutes-filter.input';

@Injectable()
export class AdminInstituteService {
  private readonly logger = new Logger(AdminInstituteService.name);

  constructor(
    private readonly instituteService: InstituteService,
    private readonly instituteRepo: InstituteRepository,
    private readonly eventBus: EventBusService,
    private readonly configService: ConfigService,
  ) {}

  async list(filter: AdminListInstitutesFilterInput) {
    const limit = filter.first ?? 20;

    const { records, total } = await this.instituteRepo.search({
      search: filter.search,
      statuses: filter.status,
      type: filter.type,
      resellerId: filter.resellerId,
      groupId: filter.groupId,
      first: limit + 1, // Fetch one extra to determine hasNextPage
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

  async approve(id: string) {
    const institute = await this.instituteService.findById(id);
    if (institute.status !== 'PENDING_APPROVAL') {
      throw new BusinessException(
        ErrorCode.SETUP_NOT_COMPLETE,
        `Cannot approve: status is ${institute.status}, must be PENDING_APPROVAL`,
      );
    }

    const record = await this.instituteRepo.updateStatus(id, 'PENDING');

    this.triggerSetupWorkflow(id, record);
    this.eventBus.emit('INSTITUTE.approved', {
      instituteId: id,
      resellerId: institute.resellerId,
      scope: 'platform',
    });
    // Notify reseller staff via event (reseller subscription picks this up)
    this.eventBus.emit('INSTITUTE.status_changed', {
      instituteId: id,
      resellerId: institute.resellerId,
      previousStatus: 'PENDING_APPROVAL',
      newStatus: 'PENDING',
    });

    return record;
  }

  async reject(id: string, reason: string) {
    const institute = await this.instituteService.findById(id);
    if (!['PENDING_APPROVAL', 'PENDING'].includes(institute.status)) {
      throw new BusinessException(
        ErrorCode.SETUP_NOT_COMPLETE,
        `Cannot reject: status is ${institute.status}, must be PENDING_APPROVAL or PENDING`,
      );
    }

    const previousStatus = institute.status;
    const record = await this.instituteRepo.updateStatus(id, 'REJECTED');
    // TODO: Store rejection reason — need repo method for settings update

    this.eventBus.emit('INSTITUTE.rejected', {
      instituteId: id,
      resellerId: institute.resellerId,
      reason,
      scope: 'platform',
    });
    // Notify reseller staff via status change event
    this.eventBus.emit('INSTITUTE.status_changed', {
      instituteId: id,
      resellerId: institute.resellerId,
      previousStatus,
      newStatus: 'REJECTED',
    });

    return record;
  }

  async getStatistics() {
    return this.instituteRepo.statistics();
  }

  private triggerSetupWorkflow(instituteId: string, institute: InstituteRecord) {
    // Fire-and-forget — don't block the approve response
    void (async () => {
      try {
        const temporalAddress =
          this.configService.get<string>('TEMPORAL_ADDRESS') ?? 'localhost:7233';
        const connection = await Connection.connect({ address: temporalAddress });
        const client = new Client({ connection });
        const { userId } = getRequestContext();

        await client.workflow.start('InstituteSetupWorkflow', {
          taskQueue: 'institute-setup',
          workflowId: `institute-setup-${instituteId}`,
          args: [
            {
              instituteId,
              type: institute.type,
              departments: [],
              board: undefined,
              isDemo: false,
              sessionInfo: {},
              creatingUserId: userId,
            },
          ],
        });

        await connection.close();
        this.logger.log(`Temporal workflow started for institute ${instituteId}`);
      } catch (err) {
        // Don't fail the approve/create operation if Temporal is unavailable
        this.logger.warn(`Failed to trigger Temporal workflow for ${instituteId}: ${err}`);
      }
    })();
  }
}
