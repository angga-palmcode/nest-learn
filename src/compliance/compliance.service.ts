import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ComplianceCheckStatus, ComplianceCheckType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddDncDto } from './dto/add-dnc.dto';
import { CreateDisclosureDto } from './dto/create-disclosure.dto';
import { QueryComplianceAuditDto } from './dto/query-compliance-audit.dto';
import { RecordConsentDto } from './dto/record-consent.dto';
import { UpdateDisclosureDto } from './dto/update-disclosure.dto';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Consent ──────────────────────────────────────────────────────────────

  async recordConsent(orgId: string, userId: string, dto: RecordConsentDto) {
    const record = await this.prisma.consentRecord.create({
      data: {
        org_id: orgId,
        lead_id: dto.lead_id,
        consent_type: dto.consent_type as any,
        consent_source: dto.consent_source,
        consent_text: dto.consent_text ?? null,
        consented_at: new Date(dto.consented_at),
        expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
      },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'compliance.consent_recorded',
      resourceType: 'ConsentRecord',
      resourceId: record.id,
      metadata: { lead_id: dto.lead_id, consent_type: dto.consent_type },
    });

    return record;
  }

  async getConsent(orgId: string, leadId: string) {
    const records = await this.prisma.consentRecord.findMany({
      where: { org_id: orgId, lead_id: leadId },
      orderBy: { consented_at: 'desc' },
    });
    return { data: records };
  }

  // ─── DNC ──────────────────────────────────────────────────────────────────

  async checkDnc(orgId: string, phoneNumber: string) {
    const entries = await this.prisma.dncRegistry.findMany({
      where: {
        phone_number: phoneNumber,
        OR: [{ org_id: orgId }, { org_id: null }],
      },
      orderBy: { added_at: 'desc' },
    });

    return {
      phone_number: phoneNumber,
      is_blocked: entries.length > 0,
      sources: entries.map((e) => ({
        source: e.source,
        added_at: e.added_at,
        reason: e.reason ?? null,
      })),
    };
  }

  async addDnc(orgId: string, userId: string, dto: AddDncDto) {
    const entry = await this.prisma.dncRegistry.create({
      data: {
        phone_number: dto.phone_number,
        source: 'manual',
        reason: dto.reason ?? null,
        lead_id: dto.lead_id ?? null,
        org_id: orgId,
        added_at: new Date(),
      },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'compliance.dnc_added',
      resourceType: 'DncRegistry',
      resourceId: entry.id,
      metadata: { phone_number: dto.phone_number },
    });

    return entry;
  }

  async syncDnc(orgId: string, userId: string) {
    // Stub: real implementation will call the national DNC registry provider API
    this.logger.log(`[DNC SYNC] Triggered for org ${orgId} by user ${userId}`);

    await this.audit.log({
      orgId,
      userId,
      action: 'compliance.dnc_sync_triggered',
      metadata: { note: 'stub — no external provider configured' },
    });

    return { message: 'DNC sync initiated. Updates will be applied shortly.' };
  }

  // ─── Recording Disclosures ─────────────────────────────────────────────────

  async listDisclosures(orgId: string) {
    const disclosures = await this.prisma.recordingDisclosure.findMany({
      where: { org_id: orgId },
      orderBy: [{ jurisdiction: 'asc' }, { language: 'asc' }, { created_at: 'desc' }],
    });
    return { data: disclosures };
  }

  async createDisclosure(orgId: string, dto: CreateDisclosureDto) {
    if (dto.is_default) {
      await this.prisma.recordingDisclosure.updateMany({
        where: { org_id: orgId, jurisdiction: dto.jurisdiction, language: dto.language, is_default: true },
        data: { is_default: false },
      });
    }

    return this.prisma.recordingDisclosure.create({
      data: {
        org_id: orgId,
        name: dto.name,
        language: dto.language,
        text: dto.text,
        audio_url: dto.audio_url,
        duration_ms: dto.duration_ms,
        jurisdiction: dto.jurisdiction,
        is_default: dto.is_default ?? false,
      },
    });
  }

  async updateDisclosure(orgId: string, id: string, dto: UpdateDisclosureDto) {
    const existing = await this.prisma.recordingDisclosure.findFirst({
      where: { id, org_id: orgId },
    });
    if (!existing) throw new NotFoundException('Disclosure not found');

    const jurisdiction = dto.jurisdiction ?? existing.jurisdiction;
    const language = dto.language ?? existing.language;

    if (dto.is_default) {
      await this.prisma.recordingDisclosure.updateMany({
        where: { org_id: orgId, jurisdiction, language, is_default: true, id: { not: id } },
        data: { is_default: false },
      });
    }

    return this.prisma.recordingDisclosure.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.text !== undefined && { text: dto.text }),
        ...(dto.audio_url !== undefined && { audio_url: dto.audio_url }),
        ...(dto.duration_ms !== undefined && { duration_ms: dto.duration_ms }),
        ...(dto.jurisdiction !== undefined && { jurisdiction: dto.jurisdiction }),
        ...(dto.is_default !== undefined && { is_default: dto.is_default }),
      },
    });
  }

  // ─── Compliance Audit ─────────────────────────────────────────────────────

  async queryAudit(orgId: string, query: QueryComplianceAuditDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 50;
    const skip = (page - 1) * pageSize;

    const where = this.buildAuditWhere(orgId, query);
    const orderBy = this.buildAuditOrderBy(query.sort);

    const [records, total] = await Promise.all([
      this.prisma.complianceCheck.findMany({ where, orderBy, skip, take: pageSize }),
      this.prisma.complianceCheck.count({ where }),
    ]);

    return {
      data: records,
      meta: {
        current_page: page,
        page_size: pageSize,
        total,
        last_page: Math.ceil(total / pageSize),
      },
    };
  }

  async exportAuditCsv(orgId: string, query: QueryComplianceAuditDto): Promise<string> {
    const where = this.buildAuditWhere(orgId, query);
    const orderBy = this.buildAuditOrderBy(query.sort);

    const records = await this.prisma.complianceCheck.findMany({ where, orderBy });

    const header = 'id,org_id,call_id,lead_id,check_type,status,checked_at,created_at,details';
    const rows = records.map((r) =>
      [
        r.id,
        r.org_id,
        r.call_id ?? '',
        r.lead_id,
        r.check_type,
        r.status,
        r.checked_at.toISOString(),
        r.created_at.toISOString(),
        `"${JSON.stringify(r.details).replace(/"/g, '""')}"`,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  // ─── Internal pipeline ────────────────────────────────────────────────────

  /**
   * Runs the full compliance pipeline before a call is placed.
   * Called by the Campaign Dialer service — not exposed as a route.
   */
  async runComplianceChecks(params: {
    orgId: string;
    leadId: string;
    phoneNumber: string;
    callingWindowStart: number; // hour in 24h, e.g. 9
    callingWindowEnd: number;   // hour in 24h, e.g. 17
    timezone: string;           // IANA timezone, e.g. 'Europe/Stockholm'
  }): Promise<{ allowed: boolean; block_reason: string | null }> {
    const { orgId, leadId, phoneNumber, callingWindowStart, callingWindowEnd, timezone } = params;
    const now = new Date();

    // Step 1: Consent
    const consent = await this.prisma.consentRecord.findFirst({
      where: {
        org_id: orgId,
        lead_id: leadId,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
      orderBy: { consented_at: 'desc' },
    });

    await this.prisma.complianceCheck.create({
      data: {
        org_id: orgId,
        lead_id: leadId,
        check_type: ComplianceCheckType.consent,
        status: consent ? ComplianceCheckStatus.passed : ComplianceCheckStatus.failed,
        details: consent
          ? { consent_record_id: consent.id, consent_type: consent.consent_type, consented_at: consent.consented_at }
          : { reason: 'No valid consent record found' },
        checked_at: now,
      },
    });

    if (!consent) return { allowed: false, block_reason: 'NO_CONSENT' };

    // Step 2: DNC
    const dncHit = await this.prisma.dncRegistry.findFirst({
      where: {
        phone_number: phoneNumber,
        OR: [{ org_id: orgId }, { org_id: null }],
      },
    });

    await this.prisma.complianceCheck.create({
      data: {
        org_id: orgId,
        lead_id: leadId,
        check_type: ComplianceCheckType.dnc,
        status: dncHit ? ComplianceCheckStatus.failed : ComplianceCheckStatus.passed,
        details: { phone_number: phoneNumber, found_on_dnc: !!dncHit },
        checked_at: now,
      },
    });

    if (dncHit) return { allowed: false, block_reason: 'DNC_BLOCKED' };

    // Step 3: Calling window
    const hourInTz = this.getHourInTimezone(now, timezone);
    const withinWindow = hourInTz >= callingWindowStart && hourInTz < callingWindowEnd;

    await this.prisma.complianceCheck.create({
      data: {
        org_id: orgId,
        lead_id: leadId,
        check_type: ComplianceCheckType.calling_window,
        status: withinWindow ? ComplianceCheckStatus.passed : ComplianceCheckStatus.failed,
        details: { current_hour: hourInTz, window_start: callingWindowStart, window_end: callingWindowEnd, timezone },
        checked_at: now,
      },
    });

    if (!withinWindow) return { allowed: false, block_reason: 'OUTSIDE_CALLING_WINDOW' };

    return { allowed: true, block_reason: null };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildAuditWhere(orgId: string, query: QueryComplianceAuditDto) {
    const where: Record<string, any> = { org_id: orgId };

    if (query.call_id) where.call_id = query.call_id;
    if (query.lead_id) where.lead_id = query.lead_id;
    if (query.check_type) where.check_type = { in: query.check_type.split(',').map((s) => s.trim()) };
    if (query.status) where.status = { in: query.status.split(',').map((s) => s.trim()) };

    if (query.date_from || query.date_to) {
      where.checked_at = {};
      if (query.date_from) where.checked_at.gte = new Date(query.date_from);
      if (query.date_to) where.checked_at.lte = new Date(query.date_to + 'T23:59:59Z');
    }

    return where;
  }

  private buildAuditOrderBy(sort?: string): Record<string, string> {
    const allowed = ['created_at', 'check_type', 'status'];
    if (!sort) return { created_at: 'desc' };
    const dir = sort.startsWith('-') ? 'desc' : 'asc';
    const field = sort.replace(/^-/, '');
    return allowed.includes(field) ? { [field]: dir } : { created_at: 'desc' };
  }

  private getHourInTimezone(date: Date, timezone: string): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }).formatToParts(date);
      const hour = parts.find((p) => p.type === 'hour');
      return hour ? parseInt(hour.value) % 24 : date.getUTCHours();
    } catch {
      return date.getUTCHours();
    }
  }
}
