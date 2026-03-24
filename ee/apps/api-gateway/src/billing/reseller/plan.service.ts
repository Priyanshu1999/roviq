import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import { getRequestContext } from '@roviq/common-types';
import type { I18nContent } from '@roviq/database';
import type { BillingInterval, FeatureLimits } from '@roviq/ee-billing-types';
import { billingError } from '../billing.errors';
import { PlanRepository } from '../repositories/plan.repository';

@Injectable()
export class PlanService {
  private readonly logger = new Logger(PlanService.name);

  constructor(
    private readonly repo: PlanRepository,
    @Inject('BILLING_NATS_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  async listPlans(resellerId: string, params: { status?: string; first: number; after?: string }) {
    return this.repo.findByResellerId(resellerId, params);
  }

  async getPlan(resellerId: string, id: string) {
    const plan = await this.repo.findById(resellerId, id);
    if (!plan) billingError('PLAN_NOT_FOUND', 'Subscription plan not found');
    return plan;
  }

  async createPlan(
    resellerId: string,
    input: {
      name: I18nContent;
      description?: I18nContent;
      code: string;
      interval: BillingInterval;
      amount: bigint;
      currency?: string;
      trialDays?: number;
      entitlements: FeatureLimits;
      sortOrder?: number;
    },
  ) {
    // Validate unique code per reseller (among non-deleted)
    const existing = await this.repo.findByCode(resellerId, input.code);
    if (existing) {
      billingError('PLAN_CODE_DUPLICATE', `Plan code "${input.code}" already exists`);
    }

    const { userId } = getRequestContext();

    const plan = await this.repo.create(resellerId, {
      resellerId,
      name: input.name,
      description: input.description,
      code: input.code,
      interval: input.interval,
      amount: input.amount,
      currency: input.currency ?? 'INR',
      trialDays: input.trialDays ?? 0,
      entitlements: input.entitlements,
      sortOrder: input.sortOrder ?? 0,
      createdBy: userId,
      updatedBy: userId,
    });

    this.emitEvent('BILLING.plan.created', { id: plan.id, name: plan.name });
    return plan;
  }

  async updatePlan(
    resellerId: string,
    id: string,
    input: {
      version: number;
      name?: I18nContent;
      description?: I18nContent;
      amount?: bigint;
      interval?: BillingInterval;
      entitlements?: FeatureLimits;
    },
  ) {
    const { version, ...data } = input;
    const plan = await this.repo.update(resellerId, id, data, version);
    this.emitEvent('BILLING.plan.updated', { id });
    return plan;
  }

  async deletePlan(resellerId: string, id: string) {
    await this.repo.softDelete(resellerId, id);
    this.emitEvent('BILLING.plan.deleted', { id });
  }
}
