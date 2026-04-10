/**
 * Certificate service (ROV-161).
 *
 * Handles TC requests/issuance, duplicate TCs, general certificate requests,
 * and Temporal workflow orchestration.
 */

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ClientProxy } from '@nestjs/microservices';
import {
  AcademicStatus,
  CertificateStatus,
  CertificateTemplateType,
  TcStatus,
} from '@roviq/common-types';
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
import { getRequestContext } from '@roviq/request-context';
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
    if (student[0].academicStatus !== AcademicStatus.ENROLLED) {
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
          status: TcStatus.REQUESTED,
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

    return this.getTCDetails(tc.id);
  }

  /** Approve a TC (principal only via CASL) */
  async approveTC(tcId: string) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    await withTenant(this.db, tenantId, async (tx) => {
      const rows = await tx
        .update(tcRegister)
        .set({ status: TcStatus.APPROVED, approvedBy: actorId, approvedAt: new Date() })
        .where(and(eq(tcRegister.id, tcId), eq(tcRegister.status, TcStatus.GENERATED)))
        .returning({ id: tcRegister.id });
      if (rows.length === 0) throw new NotFoundException('TC not found or not in generated status');
    });

    return this.getTCDetails(tcId);
  }

  /**
   * Reject a TC request with a reason.
   * Allowed from pre-issuance states: `requested`, `clearance_pending`, `clearance_complete`, `approved`.
   * Once issued the TC cannot be rejected — it must be cancelled/revoked by a separate flow.
   *
   * Persists the rejection reason into `tc_data` JSONB (merge) and sets status to `cancelled`
   * (the schema's terminal pre-issuance state — there is no `rejected` status in the CHECK constraint).
   */
  async rejectTC(id: string, reason: string, actorId: string) {
    const tenantId = this.tenantId;

    const rejectionPayload = {
      rejection_reason: reason,
      rejected_by: actorId,
      rejected_at: new Date().toISOString(),
    };

    await withTenant(this.db, tenantId, async (tx) => {
      const existing = await tx
        .select({ id: tcRegister.id, status: tcRegister.status })
        .from(tcRegister)
        .where(eq(tcRegister.id, id))
        .limit(1);

      if (existing.length === 0) throw new NotFoundException('TC not found');

      const rejectableStatuses: TcStatus[] = [
        TcStatus.REQUESTED,
        TcStatus.CLEARANCE_PENDING,
        TcStatus.CLEARANCE_COMPLETE,
        TcStatus.APPROVED,
      ];
      if (!rejectableStatuses.includes(existing[0].status)) {
        throw new BadRequestException(
          `TC cannot be rejected from status '${existing[0].status}' (allowed: ${rejectableStatuses.join(', ')})`,
        );
      }

      await tx
        .update(tcRegister)
        .set({
          status: TcStatus.CANCELLED,
          tcData: sql`COALESCE(${tcRegister.tcData}, '{}'::jsonb) || ${JSON.stringify(rejectionPayload)}::jsonb`,
          updatedBy: actorId,
        })
        .where(eq(tcRegister.id, id));
    });

    return this.getTCDetails(id);
  }

  /** Issue a TC (generates serial, updates student status) */
  async issueTC(tcId: string) {
    const tenantId = this.tenantId;
    const actorId = this.userId;

    const tc = await withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(tcRegister).where(eq(tcRegister.id, tcId)).limit(1);
    });

    if (tc.length === 0) throw new NotFoundException('TC not found');
    if (tc[0].status !== TcStatus.APPROVED) {
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
    await withTenant(this.db, tenantId, async (tx) => {
      await tx
        .update(tcRegister)
        .set({
          status: TcStatus.ISSUED,
          tcSerialNumber,
          issuedAt: new Date(),
          pdfUrl,
          qrVerificationUrl,
          updatedBy: actorId,
        })
        .where(eq(tcRegister.id, tcId));
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
          academicStatus: AcademicStatus.TRANSFERRED_OUT,
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

    return this.getTCDetails(tcId);
  }

  /**
   * Projection shared by list + detail queries. Joins user_profiles for
   * student name (i18n) and extracts `class_studied` from the tcData JSONB
   * snapshot so TC consumers get the as-of-issue class without another round-trip.
   */
  private tcSelect() {
    return {
      id: tcRegister.id,
      studentProfileId: tcRegister.studentProfileId,
      tcSerialNumber: tcRegister.tcSerialNumber,
      academicYearId: tcRegister.academicYearId,
      status: tcRegister.status,
      reason: tcRegister.reason,
      tcData: tcRegister.tcData,
      clearances: tcRegister.clearances,
      pdfUrl: tcRegister.pdfUrl,
      qrVerificationUrl: tcRegister.qrVerificationUrl,
      isDuplicate: tcRegister.isDuplicate,
      originalTcId: tcRegister.originalTcId,
      isCounterSigned: tcRegister.isCounterSigned,
      createdAt: tcRegister.createdAt,
      // Joined from user_profiles via student_profiles.user_id
      studentFirstName: userProfiles.firstName,
      studentLastName: userProfiles.lastName,
      // Snapshot captured at TC generation time (CBSE 20-field spec)
      currentStandardName: sql<string | null>`${tcRegister.tcData}->>'class_studied'`,
    };
  }

  async getTCDetails(tcId: string) {
    const tenantId = this.tenantId;
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select(this.tcSelect())
        .from(tcRegister)
        .innerJoin(studentProfiles, eq(studentProfiles.id, tcRegister.studentProfileId))
        .innerJoin(userProfiles, eq(userProfiles.userId, studentProfiles.userId))
        .where(eq(tcRegister.id, tcId))
        .limit(1);
    });
    if (rows.length === 0) throw new NotFoundException('TC not found');
    return rows[0];
  }

  async listTCs(filter?: { status?: TcStatus; studentProfileId?: string }) {
    const tenantId = this.tenantId;
    return withTenant(this.db, tenantId, async (tx) => {
      const conditions = [];
      if (filter?.status) conditions.push(eq(tcRegister.status, filter.status));
      if (filter?.studentProfileId)
        conditions.push(eq(tcRegister.studentProfileId, filter.studentProfileId));
      const where = conditions.length > 0 ? and(...conditions) : undefined;
      return tx
        .select(this.tcSelect())
        .from(tcRegister)
        .innerJoin(studentProfiles, eq(studentProfiles.id, tcRegister.studentProfileId))
        .innerJoin(userProfiles, eq(userProfiles.userId, studentProfiles.userId))
        .where(where)
        .limit(50);
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
    if (original[0].status !== TcStatus.ISSUED) {
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
          status: TcStatus.DUPLICATE_REQUESTED,
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
        .returning({ id: tcRegister.id });
      return rows[0];
    });

    return this.getTCDetails(dup.id);
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
        const fnObj = up[0]?.firstName as Record<string, string> | null | undefined;
        const lnObj = up[0]?.lastName as Record<string, string> | null | undefined;
        const fn = fnObj ? (fnObj.en ?? Object.values(fnObj)[0] ?? '') : '';
        const ln = lnObj ? (lnObj.en ?? Object.values(lnObj)[0] ?? '') : '';
        certificateData = {
          studentName: `${fn} ${ln}`.trim(),
          admissionNumber: sp[0].admissionNumber,
          class: sp[0].admissionClass,
          purpose: input.purpose,
          date: new Date().toISOString().split('T')[0],
        };
      }
    }

    // Determine initial status based on approval chain
    const approvalChain = template[0].approvalChain ?? [];
    const status =
      approvalChain.length > 0 ? CertificateStatus.PENDING_APPROVAL : CertificateStatus.DRAFT;

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
          status: CertificateStatus.ISSUED,
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

  async findCertificateById(id: string) {
    const tenantId = this.tenantId;
    const rows = await withTenant(this.db, tenantId, async (tx) => {
      return tx.select().from(issuedCertificates).where(eq(issuedCertificates.id, id)).limit(1);
    });
    if (rows.length === 0) throw new NotFoundException('Certificate not found');
    return rows[0];
  }

  /**
   * Extracts the list of Handlebars-style placeholder field names
   * from the given certificate template's content.
   *
   * If the template row has no `template_content` set (legacy rows, still
   * in setup), falls back to a deterministic hardcoded list per certificate
   * type so the frontend auto-populate experience still works. The actual
   * stored template body takes precedence when present.
   */
  async getCertificateTemplateFields(templateId: string): Promise<string[]> {
    const tenantId = this.tenantId;

    const template = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select({
          id: certificateTemplates.id,
          type: certificateTemplates.type,
          templateContent: certificateTemplates.templateContent,
        })
        .from(certificateTemplates)
        .where(eq(certificateTemplates.id, templateId))
        .limit(1);
    });
    if (template.length === 0) throw new NotFoundException('Certificate template not found');

    const content = template[0].templateContent;
    if (content && content.length > 0) {
      const seen = new Set<string>();
      const fields: string[] = [];
      const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
      let match: RegExpExecArray | null = re.exec(content);
      while (match !== null) {
        const name = match[1];
        if (!seen.has(name)) {
          seen.add(name);
          fields.push(name);
        }
        match = re.exec(content);
      }
      if (fields.length > 0) return fields;
    }

    // Fallback: hardcoded sample fields per certificate type. Covers the
    // common CBSE/state-board certificates the frontend issues today; the
    // full template-rendering pipeline will override this branch once
    // every template row has `template_content` populated.
    const type = template[0].type;
    const defaults: Record<string, string[]> = {
      bonafide_certificate: ['studentName', 'admissionNumber', 'class', 'dateOfIssue', 'purpose'],
      character_certificate: ['studentName', 'admissionNumber', 'class', 'dateOfIssue', 'purpose'],
      study_certificate: ['studentName', 'admissionNumber', 'class', 'dateOfIssue', 'purpose'],
      transfer_certificate: ['studentName', 'admissionNumber', 'class', 'dateOfIssue', 'purpose'],
      school_leaving_certificate: [
        'studentName',
        'admissionNumber',
        'class',
        'dateOfIssue',
        'purpose',
      ],
    };
    return defaults[type] ?? ['studentName', 'admissionNumber', 'class', 'dateOfIssue', 'purpose'];
  }

  /**
   * Renders a preview of a certificate by substituting student data into
   * the template body. Returns the rendered HTML so the frontend can show
   * it inline (for example via an `<iframe srcdoc>` panel).
   *
   * No DB row is written — this is a pure read. If the template has no
   * `template_content` (setup-incomplete rows), a hardcoded fallback HTML
   * is used so the preview panel still displays something meaningful. The
   * fallback uses the same Handlebars-style placeholders that the full
   * pipeline will eventually support.
   */
  async previewCertificate(input: {
    templateId: string;
    studentProfileId: string;
    purpose?: string;
  }): Promise<string> {
    const tenantId = this.tenantId;

    const template = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(certificateTemplates)
        .where(eq(certificateTemplates.id, input.templateId))
        .limit(1);
    });
    if (template.length === 0) throw new NotFoundException('Certificate template not found');

    const studentRows = await withTenant(this.db, tenantId, async (tx) => {
      return tx
        .select()
        .from(studentProfiles)
        .where(eq(studentProfiles.id, input.studentProfileId))
        .limit(1);
    });
    if (studentRows.length === 0) throw new NotFoundException('Student not found');

    const studentRow = studentRows[0];
    const up = await withAdmin(this.db, async (tx) => {
      return tx
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, studentRow.userId))
        .limit(1);
    });
    const fnObj = up[0]?.firstName as Record<string, string> | null | undefined;
    const lnObj = up[0]?.lastName as Record<string, string> | null | undefined;
    const firstName = fnObj ? (fnObj.en ?? Object.values(fnObj)[0] ?? '') : '';
    const lastName = lnObj ? (lnObj.en ?? Object.values(lnObj)[0] ?? '') : '';

    const data: Record<string, string> = {
      studentName: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      admissionNumber: studentRow.admissionNumber ?? '',
      class: studentRow.admissionClass ?? '',
      dateOfIssue: new Date().toISOString().split('T')[0] ?? '',
      purpose: input.purpose ?? '',
    };

    const defaultBodyByType: Record<string, string> = {
      bonafide_certificate: `<h1 style="text-align:center">Bonafide Certificate</h1>
<p>This is to certify that <strong>{{studentName}}</strong>, bearing admission number
<strong>{{admissionNumber}}</strong>, is a bonafide student of class <strong>{{class}}</strong> of this institute.</p>
<p>This certificate is issued for the purpose of: <em>{{purpose}}</em>.</p>
<p>Date of issue: {{dateOfIssue}}</p>`,
      character_certificate: `<h1 style="text-align:center">Character Certificate</h1>
<p>This is to certify that <strong>{{studentName}}</strong> (admission number
<strong>{{admissionNumber}}</strong>), student of class <strong>{{class}}</strong>, bears a good moral character
to the best of our knowledge.</p>
<p>Issued for: <em>{{purpose}}</em>. Date: {{dateOfIssue}}.</p>`,
      study_certificate: `<h1 style="text-align:center">Study Certificate</h1>
<p>This is to certify that <strong>{{studentName}}</strong>, admission number
<strong>{{admissionNumber}}</strong>, is pursuing studies in class <strong>{{class}}</strong> at this institute.</p>
<p>Purpose: {{purpose}}. Date: {{dateOfIssue}}.</p>`,
    };

    const body =
      template[0].templateContent && template[0].templateContent.length > 0
        ? template[0].templateContent
        : (defaultBodyByType[template[0].type] ??
          `<h1 style="text-align:center">${template[0].name}</h1>
<p>Student: <strong>{{studentName}}</strong></p>
<p>Admission number: <strong>{{admissionNumber}}</strong></p>
<p>Class: <strong>{{class}}</strong></p>
<p>Purpose: {{purpose}}. Date: {{dateOfIssue}}.</p>`);

    const rendered = body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key: string) => {
      return data[key] ?? '';
    });

    return `<!doctype html><html><head><meta charset="utf-8"><title>${template[0].name}</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;padding:24px;line-height:1.5;color:#0f172a}
h1{font-size:20px;margin:0 0 16px}p{margin:8px 0}</style></head><body>${rendered}</body></html>`;
  }

  async listCertificates(filter?: {
    type?: CertificateTemplateType;
    status?: CertificateStatus;
    studentProfileId?: string;
  }) {
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
