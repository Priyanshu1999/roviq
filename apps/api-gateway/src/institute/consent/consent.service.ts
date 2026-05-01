/**
 * Consent service (ROV-165).
 *
 * Manages DPDP Act 2023 verifiable parental consent for data processing purposes.
 * Consent records are APPEND-ONLY — each grant or withdrawal creates a new row.
 * The latest row per (guardian, student, purpose) determines current consent state.
 */

import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import type { ClientProxy } from '@nestjs/microservices';
import type { EventPattern } from '@roviq/nats-jetstream';
import {
  consentRecords,
  DRIZZLE_DB,
  type DrizzleDB,
  guardianProfilesLive,
  studentGuardianLinks,
  withTenant,
} from '@roviq/database';
import { getRequestContext } from '@roviq/request-context';
import { eq, sql } from 'drizzle-orm';
import type { GrantConsentInput } from './dto/grant-consent.input';
import type { WithdrawConsentInput } from './dto/withdraw-consent.input';

interface ConsentMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
  ) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  private emitEvent(pattern: EventPattern, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  /**
   * Resolves guardian profile ID from the user's membership ID.
   * Each guardian has exactly one guardian_profile per institute (unique membershipId).
   */
  private async resolveGuardianProfileId(tenantId: string, membershipId: string): Promise<string> {
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: guardianProfilesLive.id })
        .from(guardianProfilesLive)
        .where(eq(guardianProfilesLive.membershipId, membershipId))
        .limit(1);
    });

    if (rows.length === 0) {
      throw new ForbiddenException('Only guardians can manage consent records');
    }

    return rows[0].id;
  }

  /**
   * Validates that the given guardian is linked to the given student in this tenant.
   * Throws ForbiddenException if the link does not exist.
   */
  private async validateGuardianStudentLink(
    tenantId: string,
    guardianProfileId: string,
    studentProfileId: string,
  ): Promise<void> {
    const links = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: studentGuardianLinks.id })
        .from(studentGuardianLinks)
        .where(
          sql`${studentGuardianLinks.guardianProfileId} = ${guardianProfileId}
            AND ${studentGuardianLinks.studentProfileId} = ${studentProfileId}`,
        )
        .limit(1);
    });

    if (links.length === 0) {
      throw new ForbiddenException('Guardian is not linked to the specified student');
    }
  }

  /**
   * Grant consent for a specific data processing purpose.
   * Creates a new append-only consent record with is_granted=true.
   */
  async grantConsent(membershipId: string, input: GrantConsentInput, metadata: ConsentMetadata) {
    const tenantId = this.tenantId;
    const guardianProfileId = await this.resolveGuardianProfileId(tenantId, membershipId);

    await this.validateGuardianStudentLink(tenantId, guardianProfileId, input.studentProfileId);

    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .insert(consentRecords)
        .values({
          tenantId,
          guardianProfileId,
          studentProfileId: input.studentProfileId,
          purpose: input.purpose,
          isGranted: true,
          grantedAt: new Date(),
          verificationMethod: input.verificationMethod ?? null,
          ipAddress: metadata.ipAddress ?? null,
          userAgent: metadata.userAgent ?? null,
        })
        .returning();
    });

    const record = rows[0];

    this.emitEvent('CONSENT.given', {
      tenantId,
      guardianProfileId,
      studentProfileId: input.studentProfileId,
      purpose: input.purpose,
    });

    return record;
  }

  /**
   * Withdraw consent for a specific data processing purpose.
   * Creates a NEW append-only row with is_granted=false (never updates existing rows).
   */
  async withdrawConsent(
    membershipId: string,
    input: WithdrawConsentInput,
    metadata: ConsentMetadata,
  ) {
    const tenantId = this.tenantId;
    const guardianProfileId = await this.resolveGuardianProfileId(tenantId, membershipId);

    await this.validateGuardianStudentLink(tenantId, guardianProfileId, input.studentProfileId);

    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .insert(consentRecords)
        .values({
          tenantId,
          guardianProfileId,
          studentProfileId: input.studentProfileId,
          purpose: input.purpose,
          isGranted: false,
          withdrawnAt: new Date(),
          ipAddress: metadata.ipAddress ?? null,
          userAgent: metadata.userAgent ?? null,
        })
        .returning();
    });

    const record = rows[0];

    this.emitEvent('CONSENT.withdrawn', {
      tenantId,
      guardianProfileId,
      studentProfileId: input.studentProfileId,
      purpose: input.purpose,
    });

    return record;
  }

  /**
   * Get current consent status for every DPDP purpose for a single student.
   * Used by the guardian detail page (ROV-169) to render per-child consent
   * mini-badges. Returns one row per (purpose) with the latest state drawn
   * from `consent_records` — missing records are NOT materialised here; the
   * frontend treats absent purposes as "not yet granted / withdrawn".
   *
   * Scoped to the caller's tenant via withTenant + RLS; CASL `read Consent`
   * ability enforced at the resolver. No guardian/membership resolution
   * needed — the student itself is the scope anchor.
   */
  async consentStatusForStudent(studentProfileId: string) {
    const tenantId = this.tenantId;

    const record = await withTenant(this.db, tenantId, async (tx) => {
      return tx.execute<{
        student_profile_id: string;
        purpose: string;
        is_granted: boolean;
        created_at: Date;
      }>(
        sql`SELECT DISTINCT ON (purpose)
            student_profile_id,
            purpose,
            is_granted,
            created_at
          FROM consent_records
          WHERE student_profile_id = ${studentProfileId}
          ORDER BY purpose, created_at DESC`,
      );
    });

    return record.rows.map((row) => ({
      studentProfileId: row.student_profile_id,
      purpose: row.purpose,
      isGranted: row.is_granted,
      lastUpdatedAt: row.created_at ? new Date(row.created_at) : null,
    }));
  }

  /**
   * Get current consent status for all (student, purpose) pairs linked to this guardian.
   * Uses DISTINCT ON to find the latest consent record per (student_profile_id, purpose).
   */
  async myConsentStatus(membershipId: string) {
    const tenantId = this.tenantId;
    const guardianProfileId = await this.resolveGuardianProfileId(tenantId, membershipId);

    // Use DISTINCT ON to get the latest consent record per (student, purpose)
    const record = await withTenant(this.db, tenantId, async (tx) => {
      return tx.execute<{
        student_profile_id: string;
        purpose: string;
        is_granted: boolean;
        created_at: Date;
      }>(
        sql`SELECT DISTINCT ON (student_profile_id, purpose)
            student_profile_id,
            purpose,
            is_granted,
            created_at
          FROM consent_records
          WHERE guardian_profile_id = ${guardianProfileId}
          ORDER BY student_profile_id, purpose, created_at DESC`,
      );
    });

    return record.rows.map((row) => ({
      studentProfileId: row.student_profile_id,
      purpose: row.purpose,
      isGranted: row.is_granted,
      lastUpdatedAt: row.created_at ? new Date(row.created_at) : null,
    }));
  }
}
