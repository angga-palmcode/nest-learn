import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

const ALLOWED_SORTS = ['name', 'status', 'call_attempts', 'last_called_at', 'next_call_at', 'created_at'];

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertCampaignOwner(orgId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, org_id: orgId, deleted_at: null },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private async findLead(orgId: string, campaignId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, org_id: orgId, campaign_id: campaignId, deleted_at: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  // ─── List ─────────────────────────────────────────────────────────────────

  async listLeads(orgId: string, campaignId: string, query: ListLeadsDto) {
    await this.assertCampaignOwner(orgId, campaignId);

    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 25;
    const skip = (page - 1) * pageSize;

    const where: any = { org_id: orgId, campaign_id: campaignId, deleted_at: null };

    if (query.status) {
      where.status = { in: query.status.split(',').map((s) => s.trim()) };
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone_number: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: any = { created_at: 'desc' };
    if (query.sort) {
      const desc = query.sort.startsWith('-');
      const field = desc ? query.sort.slice(1) : query.sort;
      if (ALLOWED_SORTS.includes(field)) orderBy = { [field]: desc ? 'desc' : 'asc' };
    }

    const [total, leads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({ where, orderBy, skip, take: pageSize }),
    ]);

    return {
      data: leads,
      meta: { current_page: page, page_size: pageSize, total, last_page: Math.ceil(total / pageSize) },
    };
  }

  // ─── Get single ───────────────────────────────────────────────────────────

  async getLead(orgId: string, campaignId: string, id: string) {
    await this.assertCampaignOwner(orgId, campaignId);
    const lead = await this.findLead(orgId, campaignId, id);

    const calls = await this.prisma.call.findMany({
      where: { org_id: orgId, lead_id: id },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        status: true,
        started_at: true,
        ended_at: true,
        duration_seconds: true,
        amd_result: true,
        intent_result: true,
        disconnect_reason: true,
        created_at: true,
      },
    });

    return { data: { ...lead, calls } };
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async updateLead(
    orgId: string,
    campaignId: string,
    id: string,
    userId: string,
    dto: UpdateLeadDto,
  ) {
    await this.assertCampaignOwner(orgId, campaignId);
    const lead = await this.findLead(orgId, campaignId, id);

    // DNC is a permanent terminal state — no outbound changes allowed
    if (lead.status === 'dnc') {
      throw new ForbiddenException('Lead is on the DNC list and cannot be modified');
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status as any }),
        ...(dto.callback_notes !== undefined && { callback_notes: dto.callback_notes }),
        ...(dto.next_call_at !== undefined && { next_call_at: new Date(dto.next_call_at) }),
        ...(dto.callback_requested_at !== undefined && {
          callback_requested_at: new Date(dto.callback_requested_at),
        }),
      },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'lead.updated',
      resourceType: 'Lead',
      resourceId: id,
      metadata: { changes: dto },
    });

    return { data: updated };
  }

  // ─── CSV Export ───────────────────────────────────────────────────────────

  async exportLeadsCsv(
    orgId: string,
    campaignId: string,
    query: ListLeadsDto,
    res: Response,
  ): Promise<void> {
    await this.assertCampaignOwner(orgId, campaignId);

    const where: any = { org_id: orgId, campaign_id: campaignId, deleted_at: null };

    if (query.status) {
      where.status = { in: query.status.split(',').map((s) => s.trim()) };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone_number: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { created_at: 'asc' },
    });

    const columns = [
      'id', 'name', 'phone_number', 'email', 'status',
      'call_attempts', 'last_called_at', 'next_call_at',
      'callback_requested_at', 'callback_notes', 'upload_id',
      'timezone', 'created_at', 'updated_at',
    ] as const;

    const escapeCell = (v: unknown): string => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="leads-${campaignId}-${Date.now()}.csv"`,
    );

    res.write(columns.join(',') + '\n');
    for (const lead of leads) {
      const row = columns.map((col) => escapeCell((lead as any)[col])).join(',');
      res.write(row + '\n');
    }
    res.end();
  }
}
