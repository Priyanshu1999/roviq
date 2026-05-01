import { UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  assertTenantContext,
  CurrentUser,
  GqlAuthGuard,
  InstituteScopeGuard,
} from '@roviq/auth-backend';
import { AbilityGuard, CheckAbility } from '@roviq/casl';
import type { AuthUser } from '@roviq/common-types';
import { Client, Connection } from '@temporalio/client';
import { ExportComplianceReportInput } from './dto/export-report.input';
import { ExportReportModel, ExportStartResult } from './models/export-report.model';

const TASK_QUEUE = 'compliance-export';

@UseGuards(GqlAuthGuard, InstituteScopeGuard, AbilityGuard)
@Resolver()
export class ComplianceExportResolver {
  constructor(private readonly config: ConfigService) {}

  @Mutation(() => ExportStartResult, {
    description: 'Start a compliance export workflow — returns workflowId for progress tracking',
  })
  @CheckAbility('manage', 'Export')
  async exportComplianceReport(
    @Args('input') input: ExportComplianceReportInput,
    @CurrentUser() user: AuthUser,
  ): Promise<ExportStartResult> {
    assertTenantContext(user);
    assertTenantContext(user);
    const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
    const connection = await Connection.connect({ address });
    const client = new Client({ connection });

    const workflowId = `compliance-export-${user.tenantId}-${input.reportType}-${Date.now()}`;

    await client.workflow.start('ComplianceExportWorkflow', {
      taskQueue: TASK_QUEUE,
      workflowId,
      workflowExecutionTimeout: '10 minutes',
      args: [
        {
          tenantId: user.tenantId,
          reportType: input.reportType,
          academicYearId: input.academicYearId,
          requestedBy: user.userId,
        },
      ],
    });

    await connection.close();
    return { workflowId };
  }

  @Query(() => [ExportReportModel], {
    description:
      'List past compliance export reports (stub — returns empty until export history table is added)',
  })
  @CheckAbility('read', 'Export')
  async listExportReports(): Promise<ExportReportModel[]> {
    // TODO: Query an export_reports table when it's created.
    // For now, returns empty array. Exports are tracked via Temporal workflow history.
    return [];
  }
}
