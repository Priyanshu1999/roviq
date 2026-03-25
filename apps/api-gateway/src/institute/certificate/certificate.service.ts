/**
 * Certificate service (ROV-161).
 *
 * Handles TC requests/issuance, duplicate TCs, general certificate requests,
 * and Temporal workflow orchestration.
 */
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import { getRequestContext } from '@roviq/common-types';
import {
  certificateTemplates,
  DRIZZLE_DB,
  type DrizzleDB,
  issuedCertificates,
  studentProfiles,
  tcRegister,
  tenantSequences,
  userProfiles,
  withAdmin,
  withTenant,
} from '@roviq/database';
import { Client, Connection } from '@temporalio/client';
import { and, eq, sql } from 'drizzle-orm';

const TC_TASK_QUEUE = 'tc-issuance';

@Injectable()
export class CertificateService {
  private readonly logger = new Logger(CertificateService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDB,
    @Inject('JETSTREAM_CLIENT') private readonly natsClient: ClientProxy,
    private readonly config: ConfigService,
  ) {}

  private get tenantId(): string {
    const { tenantId } = getRequestContext();
    if (!tenantId) throw new Error('Tenant context required');
    return tenantId;
  }

  private get userId(): string {
    return getRequestContext().userId;
  }

  private emitEvent(pattern: string, data: Record<string, unknown>) {
    this.natsClient.emit(pattern, data).subscribe({
      error: (err) => this.logger.warn(`Failed to emit ${pattern}`, err),
    });
  }

  // ── TC Operations ──────────────────────────────────────

  /**
   * Request a Transfer Certificate for a student.
   * Creates tc_register row, starts Temporal TCIssuanceWorkflow.
   */
  async requestTC(input: { studentProfileId: string; reason: string; academicYearId: string }) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    // Verify student exists and is enrolled
    const student = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ id: studentProfiles.id, academicStatus: studentProfiles.academicStatus })
        .from(studentProfiles)
        .where(eq(studentProfiles.id, input.studentProfileId))
        .limit(1);
    });

    if (student.length === 0) throw new NotFoundException('Student profile not found');
    if (student[0].academicStatus !== 'enrolled') {
      throw new BadRequestException(
        `Student must be enrolled to request TC (current: ${student[0].academicStatus})`,
      );
    }

    // Generate TC serial number placeholder (final serial assigned at issuance)
    const tempSerial = `TC-REQ-${Date.now()}`;

    // Create tc_register row
    const tc = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(tcRegister)
        .values({
          tenantId,
          studentProfileId: input.studentProfileId,
          academicYearId: input.academicYearId,
          tcSerialNumber: tempSerial,
          status: 'requested',
          reason: input.reason,
          requestedBy: actorId,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
      return rows[0];
    });

    // Start Temporal workflow
    try {
      const address = this.config.get<string>('TEMPORAL_ADDRESS', 'localhost:7233');
      const connection = await Connection.connect({ address });
      const client = new Client({ connection });

      await client.workflow.start('TCIssuanceWorkflow', {
        taskQueue: TC_TASK_QUEUE,
        workflowId: `tc-issuance-${tc.id}`,
        workflowExecutionTimeout: '7 days',
        args: [
          {
            tenantId,
            tcRegisterId: tc.id,
            studentProfileId: input.studentProfileId,
            academicYearId: input.academicYearId,
            reason: input.reason,
            requestedBy: actorId,
          },
        ],
      });

      await connection.close();
      this.logger.log(`TC workflow started: ${tc.id}`);
    } catch (err) {
      this.logger.warn(`Temporal workflow failed to start for TC ${tc.id}: ${err}`);
    }

    return tc;
  }

  /** Approve a TC (principal only via CASL) */
  async approveTC(tcId: string) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    const updated = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(tcRegister)
        .set({ status: 'approved', approvedBy: actorId, approvedAt: new Date() })
        .where(and(eq(tcRegister.id, tcId), eq(tcRegister.status, 'generated')))
        .returning();
      if (rows.length === 0) throw new NotFoundException('TC not found or not in generated status');
      return rows[0];
    });

    return updated;
  }

  /** Issue a TC (generates serial, updates student status) */
  async issueTC(tcId: string) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    const tc = await withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(tcRegister).where(eq(tcRegister.id, tcId)).limit(1);
    });

    if (tc.length === 0) throw new NotFoundException('TC not found');
    if (tc[0].status !== 'approved') {
      throw new BadRequestException(
        `TC must be approved before issuance (current: ${tc[0].status})`,
      );
    }

    // Generate final serial number
    const tcSerialNumber = await withTenant(this.db, tenantId, async (tx) => {
      const seqName = `tc_no:${tc[0].academicYearId}`;
      await tx
        .insert(tenantSequences)
        .values({
          tenantId,
          sequenceName: seqName,
          currentValue: 0n,
          formatTemplate: 'TC/{value:04d}',
        })
        .onConflictDoNothing();

      const result = await tx.execute(
        sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, ${seqName})`,
      );
      const row = result.rows[0] as { next_val: string; formatted: string };
      return row.formatted || `TC/${row.next_val}`;
    });

    const today = new Date().toISOString().split('T')[0];
    const pdfUrl = `/api/storage/tc/${tenantId}/${tcId}.pdf`;
    const qrVerificationUrl = `/tc/verify/${tcSerialNumber}`;

    // Update tc_register
    const issued = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(tcRegister)
        .set({
          status: 'issued',
          tcSerialNumber,
          issuedAt: new Date(),
          pdfUrl,
          qrVerificationUrl,
          updatedBy: actorId,
        })
        .where(eq(tcRegister.id, tcId))
        .returning();
      return rows[0];
    });

    // Update student_profile (PRD §5.1 Step 5)
    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .update(studentProfiles)
        .set({
          tcIssued: true,
          tcNumber: tcSerialNumber,
          tcIssuedDate: today,
          dateOfLeaving: today,
          academicStatus: 'transferred_out',
          updatedBy: actorId,
        })
        .where(eq(studentProfiles.id, tc[0].studentProfileId));
    });

    this.emitEvent('TC.issued', {
      tcId,
      studentProfileId: tc[0].studentProfileId,
      tcSerialNumber,
      tenantId,
    });

    return issued;
  }

  async getTCDetails(tcId: string) {
    const tenantId = this.tenantId;
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(tcRegister).where(eq(tcRegister.id, tcId)).limit(1);
    });
    if (rows.length === 0) throw new NotFoundException('TC not found');
    return rows[0];
  }

  async listTCs(filter?: { status?: string; studentProfileId?: string }) {
    const tenantId = this.tenantId;
    return withTenant(this.db, tenantId, async (tx) => {
      const conditions = [];
      if (filter?.status) conditions.push(eq(tcRegister.status, filter.status));
      if (filter?.studentProfileId)
        conditions.push(eq(tcRegister.studentProfileId, filter.studentProfileId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return tx.select().from(tcRegister).where(where).limit(50);
    });
  }

  /**
   * Request duplicate TC (PRD §5.3).
   * Creates new tc_register with is_duplicate=true, original_tc_id FK.
   * Skips clearance step.
   */
  async requestDuplicateTC(input: { originalTcId: string; reason: string; duplicateFee?: bigint }) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    const original = await withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(tcRegister).where(eq(tcRegister.id, input.originalTcId)).limit(1);
    });

    if (original.length === 0) throw new NotFoundException('Original TC not found');
    if (original[0].status !== 'issued') {
      throw new BadRequestException('Can only request duplicate for an issued TC');
    }

    const tempSerial = `TC-DUP-${Date.now()}`;

    const dup = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(tcRegister)
        .values({
          tenantId,
          studentProfileId: original[0].studentProfileId,
          academicYearId: original[0].academicYearId,
          tcSerialNumber: tempSerial,
          status: 'duplicate_requested',
          reason: input.reason,
          requestedBy: actorId,
          isDuplicate: true,
          originalTcId: input.originalTcId,
          duplicateReason: input.reason,
          duplicateFee: input.duplicateFee ?? null,
          tcData: original[0].tcData,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
      return rows[0];
    });

    return dup;
  }

  // ── Certificate Operations ─────────────────────────────

  async requestCertificate(input: {
    templateId: string;
    studentProfileId?: string;
    staffProfileId?: string;
    purpose: string;
  }) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    // Fetch template
    const template = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(certificateTemplates)
        .where(eq(certificateTemplates.id, input.templateId))
        .limit(1);
    });
    if (template.length === 0) throw new NotFoundException('Certificate template not found');

    // Auto-populate certificate data from student/staff profile
    let certificateData: Record<string, unknown> = {};
    if (input.studentProfileId) {
      const studentId = input.studentProfileId;
      const sp = await withTenant(this.db, tenantId, async (tx) => {
        return tx.select().from(studentProfiles).where(eq(studentProfiles.id, studentId)).limit(1);
      });
      if (sp[0]) {
        const up = await withAdmin(this.db, async (tx) => {
          return tx
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.userId, sp[0].userId))
            .limit(1);
        });
        certificateData = {
          studentName: `${up[0]?.firstName ?? ''} ${up[0]?.lastName ?? ''}`.trim(),
          admissionNumber: sp[0].admissionNumber,
          class: sp[0].admissionClass,
          purpose: input.purpose,
          date: new Date().toISOString().split('T')[0],
        };
      }
    }

    // Determine initial status based on approval chain
    const approvalChain = template[0].approvalChain ?? [];
    const status = approvalChain.length > 0 ? 'pending_approval' : 'draft';

    // Generate serial number
    const certType = template[0].type.toUpperCase().slice(0, 3);
    const seqName = `cert_no:${certType}`;
    const serialNumber = await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .insert(tenantSequences)
        .values({
          tenantId,
          sequenceName: seqName,
          currentValue: 0n,
          formatTemplate: `CERT/${certType}/{value:04d}`,
        })
        .onConflictDoNothing();

      const result = await tx.execute(
        sql`SELECT * FROM next_sequence_value(${tenantId}::uuid, ${seqName})`,
      );
      const row = result.rows[0] as { next_val: string; formatted: string };
      return row.formatted || `CERT/${certType}/${row.next_val}`;
    });

    const cert = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .insert(issuedCertificates)
        .values({
          tenantId,
          templateId: input.templateId,
          studentProfileId: input.studentProfileId ?? null,
          staffProfileId: input.staffProfileId ?? null,
          serialNumber,
          status,
          certificateData,
          purpose: input.purpose,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
      return rows[0];
    });

    return cert;
  }

  async issueCertificate(certId: string) {
    const tenantId = this.tenantId;
    const actorId = this.userId;
    const today = new Date().toISOString().split('T')[0];

    // TODO: Render HTML template → PDF via Puppeteer/wkhtmltopdf
    const pdfUrl = `/api/storage/certificates/${tenantId}/${certId}.pdf`;

    const issued = await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(issuedCertificates)
        .set({
          status: 'issued',
          issuedDate: today,
          issuedBy: actorId,
          pdfUrl,
          updatedBy: actorId,
        })
        .where(eq(issuedCertificates.id, certId))
        .returning();
      if (rows.length === 0) throw new NotFoundException('Certificate not found');
      return rows[0];
    });

    // Fetch template type for the event
    const template = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({ type: certificateTemplates.type })
        .from(certificateTemplates)
        .where(eq(certificateTemplates.id, issued.templateId))
        .limit(1);
    });

    this.emitEvent('CERTIFICATE.generated', {
      certificateId: certId,
      type: template[0]?.type ?? 'unknown',
      tenantId,
    });

    return issued;
  }

  async listCertificates(filter?: { type?: string; status?: string; studentProfileId?: string }) {
    const tenantId = this.tenantId;
    return withTenant(this.db, tenantId, async (tx) => {
      const conditions = [];
      if (filter?.status) conditions.push(eq(issuedCertificates.status, filter.status));
      if (filter?.studentProfileId)
        conditions.push(eq(issuedCertificates.studentProfileId, filter.studentProfileId));

      // Filter by template type via JOIN
      if (filter?.type) {
        return tx
          .select({ cert: issuedCertificates })
          .from(issuedCertificates)
          .innerJoin(
            certificateTemplates,
            eq(issuedCertificates.templateId, certificateTemplates.id),
          )
          .where(
            and(
              eq(certificateTemplates.type, filter.type),
              ...(conditions.length > 0 ? conditions : []),
            ),
          )
          .limit(50)
          .then((rows) => rows.map((r) => r.cert));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return tx.select().from(issuedCertificates).where(where).limit(50);
    });
  }
}
