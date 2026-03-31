import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { CampaignAnalyticsQueryDto } from './dto/campaign-analytics-query.dto';

type HourRow = { hour: number; placed: number; answered: number };
type TimeRow = { date: Date; placed: number; answered: number; failed: number };

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Date helpers (UTC) ───────────────────────────────────────────────────

  private dayStart(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private dayEnd(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  }

  private formatTimeRow(row: TimeRow, granularity: string): string {
    const iso = row.date instanceof Date ? row.date.toISOString() : String(row.date);
    return granularity === 'hour' ? iso.slice(0, 16) : iso.slice(0, 10);
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard(orgId: string, query: DashboardQueryDto) {
    const now = new Date();
    const dateFrom = query.date_from ? new Date(query.date_from) : this.dayStart(now);
    const dateTo   = query.date_to   ? this.dayEnd(new Date(query.date_to)) : this.dayEnd(now);

    const callWhere = { org_id: orgId, started_at: { gte: dateFrom, lte: dateTo } };

    const [activeCampaigns, callsToday, callsAnsweredToday, conversionsToday, callsByHour] =
      await Promise.all([
        this.prisma.campaign.count({ where: { org_id: orgId, status: 'active', deleted_at: null } }),
        this.prisma.call.count({ where: callWhere }),
        this.prisma.call.count({
          where: { ...callWhere, status: { in: ['answered', 'completed'] as any } },
        }),
        this.prisma.lead.count({
          where: {
            org_id: orgId,
            status: 'converted' as any,
            updated_at: { gte: dateFrom, lte: dateTo },
          },
        }),
        this.prisma.$queryRaw<HourRow[]>(Prisma.sql`
          SELECT
            EXTRACT(HOUR FROM started_at)::int  AS hour,
            COUNT(*)::int                        AS placed,
            SUM(CASE WHEN status IN ('answered', 'completed') THEN 1 ELSE 0 END)::int AS answered
          FROM "Call"
          WHERE org_id    = ${orgId}
            AND started_at >= ${dateFrom}
            AND started_at <= ${dateTo}
          GROUP BY 1
          ORDER BY 1
        `),
      ]);

    const connectionRateToday =
      callsToday > 0
        ? Math.round((callsAnsweredToday / callsToday) * 10000) / 10000
        : 0;

    return {
      data: {
        active_campaigns:      activeCampaigns,
        calls_today:           callsToday,
        calls_answered_today:  callsAnsweredToday,
        connection_rate_today: connectionRateToday,
        conversions_today:     conversionsToday,
        calls_by_hour:         callsByHour,
      },
    };
  }

  // ─── Campaign Analytics ───────────────────────────────────────────────────

  async getCampaignAnalytics(
    orgId: string,
    campaignId: string,
    query: CampaignAnalyticsQueryDto,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, org_id: orgId, deleted_at: null },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');

    const granularity = query.granularity ?? 'day';
    const now      = new Date();
    const dateFrom = query.date_from ? new Date(query.date_from) : this.dayStart(now);
    const dateTo   = query.date_to   ? this.dayEnd(new Date(query.date_to)) : this.dayEnd(now);

    const callWhere = {
      org_id: orgId,
      campaign_id: campaignId,
      started_at: { gte: dateFrom, lte: dateTo },
    };

    const [
      totalCalls,
      totalAnswered,
      aggregates,
      intentGroups,
      totalLeads,
      funnelContacted,
      funnelInterested,
      funnelConverted,
      callsOverTime,
    ] = await Promise.all([
      this.prisma.call.count({ where: callWhere }),
      this.prisma.call.count({
        where: { ...callWhere, status: { in: ['answered', 'completed'] as any } },
      }),
      this.prisma.call.aggregate({
        where: callWhere,
        _avg: { duration_seconds: true },
        _sum: { cost_amount: true },
      }),
      this.prisma.call.groupBy({
        by: ['intent_result'],
        where: callWhere,
        _count: { _all: true },
      }),
      this.prisma.lead.count({
        where: { org_id: orgId, campaign_id: campaignId, deleted_at: null },
      }),
      this.prisma.lead.count({
        where: {
          org_id: orgId,
          campaign_id: campaignId,
          status: {
            in: ['contacted', 'interested', 'not_interested', 'converted', 'callback_scheduled'] as any,
          },
        },
      }),
      this.prisma.lead.count({
        where: {
          org_id: orgId,
          campaign_id: campaignId,
          status: { in: ['interested', 'converted'] as any },
        },
      }),
      this.prisma.lead.count({
        where: { org_id: orgId, campaign_id: campaignId, status: 'converted' as any },
      }),
      this.prisma.$queryRaw<TimeRow[]>(Prisma.sql`
        SELECT
          DATE_TRUNC(${Prisma.raw(`'${granularity}'`)}, started_at) AS date,
          COUNT(*)::int AS placed,
          SUM(CASE WHEN status IN ('answered', 'completed') THEN 1 ELSE 0 END)::int AS answered,
          SUM(CASE WHEN status = 'failed'                  THEN 1 ELSE 0 END)::int AS failed
        FROM "Call"
        WHERE org_id      = ${orgId}
          AND campaign_id = ${campaignId}
          AND started_at >= ${dateFrom}
          AND started_at <= ${dateTo}
        GROUP BY 1
        ORDER BY 1
      `),
    ]);

    const totalCost       = parseFloat(aggregates._sum.cost_amount?.toString() ?? '0');
    const connectionRate  = totalCalls  > 0 ? Math.round((totalAnswered / totalCalls) * 10000) / 10000 : 0;
    const conversionRate  = totalCalls  > 0 ? Math.round((funnelConverted / totalCalls) * 10000) / 10000 : 0;
    const costPerCall      = totalCalls       > 0 ? Math.round((totalCost / totalCalls) * 100) / 100 : 0;
    const costPerConversion = funnelConverted > 0 ? Math.round((totalCost / funnelConverted) * 100) / 100 : 0;
    const avgDuration     = Math.round(aggregates._avg.duration_seconds ?? 0);

    // Build intent distribution with all known keys defaulting to 0
    const intentDistribution: Record<string, number> = {
      interested:         0,
      not_interested:     0,
      callback_requested: 0,
      dnc_requested:      0,
      undetermined:       0,
    };
    for (const g of intentGroups) {
      if (g.intent_result && g.intent_result in intentDistribution) {
        intentDistribution[g.intent_result] = g._count._all;
      }
    }

    return {
      data: {
        summary: {
          total_calls:               totalCalls,
          total_answered:            totalAnswered,
          connection_rate:           connectionRate,
          total_conversions:         funnelConverted,
          conversion_rate:           conversionRate,
          average_duration_seconds:  avgDuration,
          total_cost:                totalCost,
          cost_per_call:             costPerCall,
          cost_per_conversion:       costPerConversion,
        },
        funnel: {
          total_leads: totalLeads,
          contacted:   funnelContacted,
          interested:  funnelInterested,
          converted:   funnelConverted,
        },
        intent_distribution: intentDistribution,
        calls_over_time: callsOverTime.map((r) => ({
          date:     this.formatTimeRow(r, granularity),
          placed:   r.placed,
          answered: r.answered,
          failed:   r.failed,
        })),
      },
    };
  }
}
