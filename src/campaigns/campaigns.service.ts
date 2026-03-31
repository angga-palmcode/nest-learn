import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

const ALLOWED_SORTS = ['name', 'status', 'created_at', 'updated_at'];

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(orgId: string, userId: string, dto: CreateCampaignDto) {
    const disclosure = await this.prisma.recordingDisclosure.findFirst({
      where: { id: dto.disclosure_id, org_id: orgId },
    });
    if (!disclosure) throw new BadRequestException('Invalid disclosure_id');

    const campaign = await this.prisma.campaign.create({
      data: {
        org_id: orgId,
        created_by: userId,
        name: dto.name,
        description: dto.description ?? null,
        script: dto.script,
        voice_id: dto.voice_id,
        language: dto.language ?? 'sv',
        caller_id: dto.caller_id,
        disclosure_id: dto.disclosure_id,
        schedule_timezone: dto.schedule_timezone ?? 'Europe/Stockholm',
        schedule_start_time: dto.schedule_start_time,
        schedule_end_time: dto.schedule_end_time,
        schedule_days: dto.schedule_days,
        max_concurrent_calls: dto.max_concurrent_calls ?? 10,
        max_attempts_per_lead: dto.max_attempts_per_lead ?? 3,
        retry_interval_minutes: dto.retry_interval_minutes ?? 60,
        amd_action: (dto.amd_action ?? 'hang_up') as any,
        voicemail_script: dto.voicemail_script ?? null,
      },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'campaign.created',
      resourceType: 'Campaign',
      resourceId: campaign.id,
      metadata: { name: campaign.name },
    });

    return campaign;
  }

  async list(orgId: string, query: ListCampaignsDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 25;
    const skip = (page - 1) * pageSize;

    const where: any = { org_id: orgId, deleted_at: null };

    if (query.status) {
      where.status = { in: query.status.split(',').map((s) => s.trim()) };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { created_at: 'desc' };
    if (query.sort) {
      const desc = query.sort.startsWith('-');
      const field = desc ? query.sort.slice(1) : query.sort;
      if (ALLOWED_SORTS.includes(field)) orderBy = { [field]: desc ? 'desc' : 'asc' };
    }

    const includes = (query.include ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const includeLeadStats = includes.includes('leadStats');

    const [total, campaigns] = await Promise.all([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({ where, orderBy, skip, take: pageSize }),
    ]);

    let data: any[] = campaigns;
    if (includeLeadStats) {
      data = await Promise.all(
        campaigns.map(async (campaign) => {
          const [total, contacted, converted] = await Promise.all([
            this.prisma.lead.count({ where: { campaign_id: campaign.id } }),
            this.prisma.lead.count({
              where: { campaign_id: campaign.id, status: { in: ['contacted', 'converted'] } },
            }),
            this.prisma.lead.count({ where: { campaign_id: campaign.id, status: 'converted' } }),
          ]);
          return { ...campaign, leadStats: { total, contacted, converted } };
        }),
      );
    }

    return {
      data,
      meta: { current_page: page, page_size: pageSize, total, last_page: Math.ceil(total / pageSize) },
    };
  }

  async findOne(orgId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, org_id: orgId, deleted_at: null },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(orgId: string, id: string, userId: string, dto: UpdateCampaignDto) {
    const campaign = await this.findOne(orgId, id);

    if (!['draft', 'paused'].includes(campaign.status)) {
      throw new BadRequestException('Campaign can only be updated when in draft or paused status');
    }

    if (dto.disclosure_id) {
      const disclosure = await this.prisma.recordingDisclosure.findFirst({
        where: { id: dto.disclosure_id, org_id: orgId },
      });
      if (!disclosure) throw new BadRequestException('Invalid disclosure_id');
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.script !== undefined && { script: dto.script }),
        ...(dto.voice_id !== undefined && { voice_id: dto.voice_id }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.caller_id !== undefined && { caller_id: dto.caller_id }),
        ...(dto.disclosure_id !== undefined && { disclosure_id: dto.disclosure_id }),
        ...(dto.schedule_timezone !== undefined && { schedule_timezone: dto.schedule_timezone }),
        ...(dto.schedule_start_time !== undefined && { schedule_start_time: dto.schedule_start_time }),
        ...(dto.schedule_end_time !== undefined && { schedule_end_time: dto.schedule_end_time }),
        ...(dto.schedule_days !== undefined && { schedule_days: dto.schedule_days }),
        ...(dto.max_concurrent_calls !== undefined && { max_concurrent_calls: dto.max_concurrent_calls }),
        ...(dto.max_attempts_per_lead !== undefined && { max_attempts_per_lead: dto.max_attempts_per_lead }),
        ...(dto.retry_interval_minutes !== undefined && { retry_interval_minutes: dto.retry_interval_minutes }),
        ...(dto.amd_action !== undefined && { amd_action: dto.amd_action as any }),
        ...(dto.voicemail_script !== undefined && { voicemail_script: dto.voicemail_script }),
      },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'campaign.updated',
      resourceType: 'Campaign',
      resourceId: id,
    });

    return updated;
  }

  async remove(orgId: string, id: string, userId: string) {
    const campaign = await this.findOne(orgId, id);

    if (!['draft', 'completed'].includes(campaign.status)) {
      throw new BadRequestException('Campaign can only be deleted when in draft or completed status');
    }

    await this.prisma.campaign.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'campaign.deleted',
      resourceType: 'Campaign',
      resourceId: id,
    });

    return { message: 'Campaign deleted' };
  }

  // ─── Campaign Actions ──────────────────────────────────────────────────────

  async activate(orgId: string, id: string, userId: string) {
    const campaign = await this.findOne(orgId, id);

    if (!['draft', 'paused'].includes(campaign.status)) {
      throw new BadRequestException('Campaign must be in draft or paused status to activate');
    }

    const leadCount = await this.prisma.lead.count({ where: { campaign_id: id } });
    if (leadCount === 0) {
      throw new BadRequestException('Campaign must have at least one lead before activation');
    }

    const disclosure = await this.prisma.recordingDisclosure.findFirst({
      where: { id: campaign.disclosure_id, org_id: orgId },
    });
    if (!disclosure) {
      throw new BadRequestException('Campaign disclosure is invalid or has been removed');
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        status: 'active',
        started_at: campaign.started_at ?? new Date(),
      },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'campaign.activated',
      resourceType: 'Campaign',
      resourceId: id,
    });

    return updated;
  }

  async pause(orgId: string, id: string, userId: string) {
    const campaign = await this.findOne(orgId, id);

    if (campaign.status !== 'active') {
      throw new BadRequestException('Only active campaigns can be paused');
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'paused' },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'campaign.paused',
      resourceType: 'Campaign',
      resourceId: id,
    });

    return updated;
  }

  async resume(orgId: string, id: string, userId: string) {
    const campaign = await this.findOne(orgId, id);

    if (campaign.status !== 'paused') {
      throw new BadRequestException('Only paused campaigns can be resumed');
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: 'active' },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'campaign.resumed',
      resourceType: 'Campaign',
      resourceId: id,
    });

    return updated;
  }

  // ─── Lead Upload ───────────────────────────────────────────────────────────

  async uploadLeads(
    orgId: string,
    campaignId: string,
    userId: string,
    file: Express.Multer.File,
    fieldMappingRaw: string,
    skipFirstRow: boolean,
  ) {
    await this.findOne(orgId, campaignId);

    let fieldMapping: Record<string, string>;
    try {
      fieldMapping = JSON.parse(fieldMappingRaw);
    } catch {
      throw new BadRequestException('field_mapping must be valid JSON');
    }

    if (!fieldMapping['name'] || !fieldMapping['phone']) {
      throw new BadRequestException('field_mapping must include "name" and "phone" keys');
    }

    const upload = await this.prisma.leadUpload.create({
      data: { org_id: orgId, campaign_id: campaignId, status: 'processing' },
    });

    // Process async — caller gets 202 immediately
    this.processLeadUpload(orgId, campaignId, upload.id, file.buffer, fieldMapping, skipFirstRow).catch(
      (err) => this.logger.error(`Upload ${upload.id} failed: ${(err as Error).message}`),
    );

    return {
      data: {
        upload_id: upload.id,
        status: 'processing',
        total_rows: 0,
        message: 'CSV upload received and is being processed.',
      },
    };
  }

  async getUploadStatus(orgId: string, campaignId: string, uploadId: string) {
    await this.findOne(orgId, campaignId);

    const upload = await this.prisma.leadUpload.findFirst({
      where: { id: uploadId, campaign_id: campaignId },
    });
    if (!upload) throw new NotFoundException('Upload not found');

    return { data: upload };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private async processLeadUpload(
    orgId: string,
    campaignId: string,
    uploadId: string,
    buffer: Buffer,
    fieldMapping: Record<string, string>,
    skipFirstRow: boolean,
  ): Promise<void> {
    try {
      const lines = buffer.toString('utf-8').split('\n').filter((l) => l.trim());
      const rows = skipFirstRow ? lines.slice(1) : lines;

      // Build colIndex → fieldName map  e.g. { 0: 'name', 1: 'phone' }
      const colMap: Record<number, string> = {};
      for (const [field, colKey] of Object.entries(fieldMapping)) {
        const colIndex = parseInt(colKey.replace('column_', ''), 10);
        if (!isNaN(colIndex)) colMap[colIndex] = field;
      }

      let validRows = 0;
      let invalidRows = 0;
      let duplicateRows = 0;
      const errors: Array<{ row: number; field: string; error: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const rowNum = (skipFirstRow ? 2 : 1) + i;
        const cols = this.parseCsvLine(rows[i]);
        const rowData: Record<string, string> = {};
        for (const [colIndex, fieldName] of Object.entries(colMap)) {
          rowData[fieldName] = cols[Number(colIndex)] ?? '';
        }

        const rowErrors: Array<{ field: string; error: string }> = [];

        if (!rowData['name']?.trim()) {
          rowErrors.push({ field: 'name', error: 'Name is required' });
        }

        const phone = this.normalizePhone(rowData['phone'] ?? '');
        if (!phone) {
          rowErrors.push({ field: 'phone', error: `Invalid phone number format: '${rowData['phone']}'` });
        }

        if (rowErrors.length > 0) {
          invalidRows++;
          for (const e of rowErrors) errors.push({ row: rowNum, ...e });
          continue;
        }

        const existing = await this.prisma.lead.findFirst({
          where: { campaign_id: campaignId, phone: phone! },
        });
        if (existing) {
          duplicateRows++;
          continue;
        }

        const customFields: Record<string, string> = {};
        for (const [field, value] of Object.entries(rowData)) {
          if (!['name', 'phone', 'email'].includes(field)) customFields[field] = value;
        }

        await this.prisma.lead.create({
          data: {
            org_id: orgId,
            campaign_id: campaignId,
            name: rowData['name'].trim(),
            phone: phone!,
            email: rowData['email']?.trim() || null,
            custom_fields: Object.keys(customFields).length ? customFields : undefined,
          },
        });

        validRows++;
      }

      await this.prisma.leadUpload.update({
        where: { id: uploadId },
        data: {
          status: 'completed',
          total_rows: rows.length,
          valid_rows: validRows,
          invalid_rows: invalidRows,
          duplicate_rows: duplicateRows,
          errors: errors.length ? errors : undefined,
        },
      });
    } catch (err) {
      await this.prisma.leadUpload.update({
        where: { id: uploadId },
        data: { status: 'failed' },
      });
      throw err;
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += line[i];
      }
    }
    result.push(current.trim());
    return result;
  }

  private normalizePhone(raw: string): string | null {
    if (!raw?.trim()) return null;
    const cleaned = raw.trim().replace(/[\s\-().]/g, '');
    if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;
    if (/^00\d{7,13}$/.test(cleaned)) return '+' + cleaned.slice(2);
    if (/^0\d{7,12}$/.test(cleaned)) return '+46' + cleaned.slice(1); // Swedish default
    return null;
  }
}
