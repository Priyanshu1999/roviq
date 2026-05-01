import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BusinessException, ErrorCode } from '@roviq/common-types';
import { instituteContactSchema } from '@roviq/database';
import type { EventPattern } from '@roviq/nats-jetstream';
import { EventBusService } from '../../common/event-bus.service';
import { encodeCursor } from '../../common/pagination/relay-pagination.model';
import type { CreateInstituteInput } from './dto/create-institute.input';
import type { InstituteFilterInput } from './dto/institute-filter.input';
import type { UpdateInstituteBrandingInput } from './dto/update-institute-branding.input';
import type { UpdateInstituteConfigInput } from './dto/update-institute-config.input';
import type { UpdateInstituteInfoInput } from './dto/update-institute-info.input';
import { InstituteRepository } from './repositories/institute.repository';
import type { InstituteRecord, UpdateInstituteConfigData } from './repositories/types';
import { InstituteSetupService } from './seed/institute-setup.service';

// Valid status transitions: from → [allowed targets]
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACTIVE', 'REJECTED'],
  ACTIVE: ['INACTIVE', 'SUSPENDED'],
  INACTIVE: ['ACTIVE'],
  SUSPENDED: ['ACTIVE'],
  // REJECTED is terminal — no transitions out
};

@Injectable()
export class InstituteService {
  private readonly logger = new Logger(InstituteService.name);

  constructor(
    private readonly instituteRepo: InstituteRepository,
    private readonly setupService: InstituteSetupService,
    private readonly eventBus: EventBusService,
  ) {}

  private emitEvent(pattern: EventPattern, data: Record<string, unknown>) {
    this.eventBus.emit(pattern, data);
  }

  async search(filter: InstituteFilterInput) {
    const { records, total } = await this.instituteRepo.search({
      search: filter.search,
      status: filter.status,
      type: filter.type,
      first: (filter.first ?? 20) + 1, // Fetch one extra to determine hasNextPage
      after: filter.after,
    });

    const limit = filter.first ?? 20;
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

  async findById(id: string): Promise<InstituteRecord> {
    const record = await this.instituteRepo.findById(id);
    if (!record) {
      throw new NotFoundException(`Institute ${id} not found`);
    }
    return record;
  }

  async create(input: CreateInstituteInput): Promise<InstituteRecord> {
    const record = await this.instituteRepo.create(input);

    // Trigger async setup — runs synchronously for now, will be Temporal workflow later
    this.setupService
      .runSetup({
        instituteId: record.id,
        type: input.type ?? 'SCHOOL',
        departments: input.departments ?? [
          'PRIMARY',
          'UPPER_PRIMARY',
          'SECONDARY',
          'SENIOR_SECONDARY',
        ],
        board: input.board,
        isDemo: input.isDemo,
      })
      .catch((err) => {
        this.logger.error(`Setup failed for institute ${record.id}`, err);
      });

    // Spread the full record so the `adminInstituteCreated` /
    // `resellerInstituteCreated` subscriptions (both typed as InstituteModel)
    // can resolve any selected field. `resellerId` flows through from the
    // record — the reseller-scope filter matches on it.
    this.emitEvent('INSTITUTE.created', { ...record, type: input.type });

    return record;
  }

  async updateInfo(id: string, input: UpdateInstituteInfoInput): Promise<InstituteRecord> {
    if (input.contact) {
      const result = instituteContactSchema.safeParse(input.contact);
      if (!result.success) {
        throw new BadRequestException(result.error.message);
      }
    }

    const record = await this.instituteRepo.updateInfo(id, input);

    // The GraphQL subscription `instituteUpdated` filters on payload.id ===
    // context.user.tenantId, so the payload must carry the institute id.
    // Emit the full record so clients can resolve any selected field.
    this.emitEvent('INSTITUTE.updated', { ...record, changedFields: Object.keys(input) });

    return record;
  }

  async updateBranding(
    instituteId: string,
    input: UpdateInstituteBrandingInput,
  ): Promise<InstituteRecord> {
    const record = await this.instituteRepo.updateBranding(instituteId, input);
    this.emitEvent('INSTITUTE.branding_updated', { instituteId, branding: input });
    return record;
  }

  async updateConfig(
    instituteId: string,
    input: UpdateInstituteConfigInput,
  ): Promise<InstituteRecord> {
    const record = await this.instituteRepo.updateConfig(
      instituteId,
      input as UpdateInstituteConfigData,
    );
    this.emitEvent('INSTITUTE.config_updated', {
      instituteId,
      changedFields: Object.keys(input),
    });
    return record;
  }

  async activate(id: string): Promise<InstituteRecord> {
    const institute = await this.requireInstitute(id);
    this.validateTransition(institute.status, 'ACTIVE');

    if (institute.setupStatus !== 'COMPLETED') {
      throw new BusinessException(
        ErrorCode.SETUP_NOT_COMPLETE,
        `Cannot activate institute: setup_status is ${institute.setupStatus}, must be COMPLETED`,
      );
    }

    const record = await this.instituteRepo.updateStatus(id, 'ACTIVE');
    this.emitEvent('INSTITUTE.activated', { instituteId: id, previousStatus: institute.status });
    return record;
  }

  async deactivate(id: string): Promise<InstituteRecord> {
    const institute = await this.requireInstitute(id);
    this.validateTransition(institute.status, 'INACTIVE');
    const record = await this.instituteRepo.updateStatus(id, 'INACTIVE');
    this.emitEvent('INSTITUTE.deactivated', { instituteId: id, previousStatus: institute.status });
    return record;
  }

  async suspend(id: string, reason?: string): Promise<InstituteRecord> {
    const institute = await this.requireInstitute(id);
    this.validateTransition(institute.status, 'SUSPENDED');
    const record = await this.instituteRepo.updateStatus(id, 'SUSPENDED');
    this.emitEvent('INSTITUTE.suspended', {
      instituteId: id,
      previousStatus: institute.status,
      reason,
    });
    return record;
  }

  async reject(id: string): Promise<InstituteRecord> {
    const institute = await this.requireInstitute(id);
    this.validateTransition(institute.status, 'REJECTED');
    const record = await this.instituteRepo.updateStatus(id, 'REJECTED');
    this.emitEvent('INSTITUTE.rejected', { instituteId: id, previousStatus: institute.status });
    return record;
  }

  async delete(id: string): Promise<boolean> {
    await this.requireInstitute(id);
    await this.instituteRepo.softDelete(id);
    this.emitEvent('INSTITUTE.deleted', { instituteId: id });
    return true;
  }

  async restore(id: string): Promise<InstituteRecord> {
    const record = await this.instituteRepo.restore(id);
    this.emitEvent('INSTITUTE.restored', { instituteId: id });
    return record;
  }

  async findBranding(instituteId: string) {
    return this.instituteRepo.findBranding(instituteId);
  }

  async findConfig(instituteId: string) {
    return this.instituteRepo.findConfig(instituteId);
  }

  async findIdentifiers(instituteId: string) {
    return this.instituteRepo.findIdentifiers(instituteId);
  }

  async findAffiliations(instituteId: string) {
    return this.instituteRepo.findAffiliations(instituteId);
  }

  private async requireInstitute(id: string): Promise<InstituteRecord> {
    const record = await this.instituteRepo.findById(id);
    if (!record) {
      throw new NotFoundException(`Institute ${id} not found`);
    }
    return record;
  }

  private validateTransition(currentStatus: string, targetStatus: string): void {
    const allowed = STATUS_TRANSITIONS[currentStatus];
    if (!allowed?.includes(targetStatus)) {
      throw new BadRequestException(`Cannot transition from ${currentStatus} to ${targetStatus}`);
    }
  }
}
