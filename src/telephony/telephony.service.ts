import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ComplianceService } from '../compliance/compliance.service';
import { PrismaService } from '../prisma/prisma.service';
import { ListCallsDto } from './dto/list-calls.dto';
import { TelnyxAdapter } from './providers/telnyx.adapter';
import { TwilioAdapter } from './providers/twilio.adapter';

const ALLOWED_SORTS = ['started_at', 'ended_at', 'duration_seconds', 'status', 'intent_result'];

@Injectable()
export class TelephonyService {
  private readonly logger = new Logger(TelephonyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly compliance: ComplianceService,
    private readonly telnyx: TelnyxAdapter,
    private readonly twilio: TwilioAdapter,
  ) {}

  // ─── Public HTTP Endpoints ────────────────────────────────────────────────

  async listCalls(orgId: string, query: ListCallsDto) {
    const page = query.page ?? 1;
    const pageSize = query.page_size ?? 50;
    const skip = (page - 1) * pageSize;

    const where: any = { org_id: orgId };
    if (query.campaign_id) where.campaign_id = query.campaign_id;
    if (query.lead_id) where.lead_id = query.lead_id;
    if (query.status) {
      where.status = { in: query.status.split(',').map((s) => s.trim()) };
    }
    if (query.intent_result) {
      where.intent_result = { in: query.intent_result.split(',').map((s) => s.trim()) };
    }
    if (query.date_from || query.date_to) {
      where.started_at = {};
      if (query.date_from) where.started_at.gte = new Date(query.date_from);
      if (query.date_to) where.started_at.lte = new Date(query.date_to);
    }

    let orderBy: any = { started_at: 'desc' };
    if (query.sort) {
      const desc = query.sort.startsWith('-');
      const field = desc ? query.sort.slice(1) : query.sort;
      if (ALLOWED_SORTS.includes(field)) orderBy = { [field]: desc ? 'desc' : 'asc' };
    }

    const includes = (query.include ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const includeCompliance = includes.includes('complianceChecks');

    const [total, calls] = await Promise.all([
      this.prisma.call.count({ where }),
      this.prisma.call.findMany({ where, orderBy, skip, take: pageSize }),
    ]);

    let data: any[] = calls;
    if (includeCompliance) {
      data = await Promise.all(
        calls.map(async (call) => ({
          ...call,
          complianceChecks: await this.prisma.complianceCheck.findMany({
            where: { call_id: call.id },
          }),
        })),
      );
    }

    return {
      data,
      meta: {
        current_page: page,
        page_size: pageSize,
        total,
        last_page: Math.ceil(total / pageSize),
      },
    };
  }

  async getCall(orgId: string, id: string) {
    const call = await this.prisma.call.findFirst({ where: { id, org_id: orgId } });
    if (!call) throw new NotFoundException('Call not found');

    const complianceChecks = await this.prisma.complianceCheck.findMany({
      where: { call_id: id },
    });

    return { ...call, complianceChecks };
  }

  async getCallRecording(orgId: string, id: string) {
    const call = await this.prisma.call.findFirst({
      where: { id, org_id: orgId },
      select: { id: true, recording_url: true },
    });
    if (!call) throw new NotFoundException('Call not found');
    if (!call.recording_url) throw new NotFoundException('No recording available for this call');

    // TODO: Replace with real pre-signed URL from Cloud Storage (GCS/S3)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    return { url: call.recording_url, expires_at: expiresAt };
  }

  async getCallTranscript(orgId: string, id: string) {
    const call = await this.prisma.call.findFirst({
      where: { id, org_id: orgId },
      select: { id: true, transcript_url: true, duration_seconds: true },
    });
    if (!call) throw new NotFoundException('Call not found');
    if (!call.transcript_url) throw new NotFoundException('No transcript available for this call');

    // TODO: Fetch and parse transcript JSON from Cloud Storage URL
    return {
      call_id: id,
      transcript_url: call.transcript_url,
      duration_seconds: call.duration_seconds,
    };
  }

  // ─── Internal Pipeline (called by Campaign Dialer) ────────────────────────

  /**
   * Place an outbound call with compliance gating and Telnyx → Twilio failover.
   * Not exposed as an HTTP route — called by the Campaign Dialer module.
   */
  async placeCall(params: {
    orgId: string;
    campaignId: string;
    leadId: string;
    fromNumber: string;
    toNumber: string;
    callingWindowStart: number; // hour 0-23
    callingWindowEnd: number;   // hour 0-23
    timezone: string;           // IANA e.g. 'Europe/Stockholm'
  }): Promise<{ allowed: boolean; callId: string; blockReason?: string }> {
    const { orgId, campaignId, leadId, fromNumber, toNumber, callingWindowStart, callingWindowEnd, timezone } = params;

    // Step 1: Compliance gate
    const compliance = await this.compliance.runComplianceChecks({
      orgId,
      leadId,
      phoneNumber: toNumber,
      callingWindowStart,
      callingWindowEnd,
      timezone,
    });

    if (!compliance.allowed) {
      const call = await this.prisma.call.create({
        data: {
          org_id: orgId,
          campaign_id: campaignId,
          lead_id: leadId,
          provider: 'telnyx',
          from_number: fromNumber,
          to_number: toNumber,
          status: 'cancelled',
          direction: 'outbound',
          compliance_result: 'blocked',
          compliance_block_reason: compliance.block_reason ?? undefined,
        },
      });
      return { allowed: false, callId: call.id, blockReason: compliance.block_reason ?? undefined };
    }

    // Step 2: Place call — Telnyx primary, Twilio failover
    let providerCallId: string | undefined;
    let usedProvider: 'telnyx' | 'twilio' = 'telnyx';

    try {
      const result = await this.telnyx.placeCall(fromNumber, toNumber, {});
      providerCallId = result.providerCallId;
    } catch (telnyxErr) {
      this.logger.warn(`Telnyx failed: ${(telnyxErr as Error).message}. Falling back to Twilio.`);
      try {
        usedProvider = 'twilio';
        const result = await this.twilio.placeCall(fromNumber, toNumber, {});
        providerCallId = result.providerCallId;
      } catch (twilioErr) {
        const reason = `telnyx: ${(telnyxErr as Error).message}; twilio: ${(twilioErr as Error).message}`;
        this.logger.error(`Both providers failed — ${reason}`);
        const call = await this.prisma.call.create({
          data: {
            org_id: orgId,
            campaign_id: campaignId,
            lead_id: leadId,
            provider: usedProvider,
            from_number: fromNumber,
            to_number: toNumber,
            status: 'failed',
            direction: 'outbound',
            compliance_result: 'passed',
            disconnect_reason: reason,
          },
        });
        return { allowed: true, callId: call.id };
      }
    }

    const call = await this.prisma.call.create({
      data: {
        org_id: orgId,
        campaign_id: campaignId,
        lead_id: leadId,
        provider: usedProvider,
        provider_call_id: providerCallId,
        from_number: fromNumber,
        to_number: toNumber,
        status: 'queued',
        direction: 'outbound',
        compliance_result: 'passed',
      },
    });

    return { allowed: true, callId: call.id };
  }
}
