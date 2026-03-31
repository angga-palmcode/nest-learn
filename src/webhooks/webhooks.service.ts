import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

// Retry schedule: 10s, 60s, 300s
const RETRY_DELAYS_MS = [10_000, 60_000, 300_000];

export interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async create(orgId: string, userId: string, dto: CreateWebhookDto) {
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await this.prisma.webhookEndpoint.create({
      data: {
        org_id: orgId,
        url: dto.url,
        secret,
        events: dto.events,
      },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'webhook.created',
      resourceType: 'WebhookEndpoint',
      resourceId: webhook.id,
      metadata: { url: webhook.url, events: webhook.events },
    });

    return { data: webhook };
  }

  async list(orgId: string) {
    const webhooks = await this.prisma.webhookEndpoint.findMany({
      where: { org_id: orgId },
      orderBy: { created_at: 'desc' },
    });
    return { data: webhooks };
  }

  async findOne(orgId: string, id: string) {
    const webhook = await this.prisma.webhookEndpoint.findFirst({
      where: { id, org_id: orgId },
    });
    if (!webhook) throw new NotFoundException('Webhook endpoint not found');
    return { data: webhook };
  }

  async update(orgId: string, id: string, userId: string, dto: UpdateWebhookDto) {
    const { data: existing } = await this.findOne(orgId, id);

    const updated = await this.prisma.webhookEndpoint.update({
      where: { id: existing.id },
      data: {
        ...(dto.url !== undefined && { url: dto.url }),
        ...(dto.events !== undefined && { events: dto.events }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'webhook.updated',
      resourceType: 'WebhookEndpoint',
      resourceId: id,
      metadata: { changes: dto },
    });

    return { data: updated };
  }

  async remove(orgId: string, id: string, userId: string) {
    await this.findOne(orgId, id);

    await this.prisma.webhookEndpoint.delete({ where: { id } });

    await this.audit.log({
      orgId,
      userId,
      action: 'webhook.deleted',
      resourceType: 'WebhookEndpoint',
      resourceId: id,
    });

    return { message: 'Webhook endpoint deleted' };
  }

  async rotateSecret(orgId: string, id: string, userId: string) {
    await this.findOne(orgId, id);

    const secret = crypto.randomBytes(32).toString('hex');
    const updated = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { secret },
    });

    await this.audit.log({
      orgId,
      userId,
      action: 'webhook.secret_rotated',
      resourceType: 'WebhookEndpoint',
      resourceId: id,
    });

    return { data: { id: updated.id, secret } };
  }

  // ─── Delivery ─────────────────────────────────────────────────────────────

  /**
   * Dispatch a webhook event to all matching active endpoints for the org.
   * Fire-and-forget — call sites do not await this.
   */
  async dispatch(orgId: string, payload: WebhookPayload): Promise<void> {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { org_id: orgId, is_active: true },
    });

    for (const endpoint of endpoints) {
      const events = Array.isArray(endpoint.events) ? (endpoint.events as string[]) : [];
      if (!events.includes(payload.event)) continue;

      this.deliverWithRetry(endpoint.id, endpoint.url, endpoint.secret, payload).catch(
        (err) => this.logger.error(`Webhook ${endpoint.id} permanently failed: ${(err as Error).message}`),
      );
    }
  }

  private async deliverWithRetry(
    endpointId: string,
    url: string,
    secret: string,
    payload: WebhookPayload,
    attempt = 0,
  ): Promise<void> {
    const deliveryId = crypto.randomUUID();
    const timestamp  = new Date().toISOString();
    const body       = JSON.stringify({ event: payload.event, timestamp, data: payload.data });
    const signature  = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: {
          'Content-Type':       'application/json',
          'X-Astos-Signature':  signature,
          'X-Astos-Event':      payload.event,
          'X-Astos-Delivery':   deliveryId,
          'X-Astos-Timestamp':  timestamp,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      this.logger.log(`Webhook ${endpointId} delivered (attempt ${attempt + 1})`);
    } catch (err) {
      if (attempt < RETRY_DELAYS_MS.length - 1) {
        const delay = RETRY_DELAYS_MS[attempt];
        this.logger.warn(
          `Webhook ${endpointId} attempt ${attempt + 1} failed — retrying in ${delay}ms: ${(err as Error).message}`,
        );
        await new Promise((r) => setTimeout(r, delay));
        return this.deliverWithRetry(endpointId, url, secret, payload, attempt + 1);
      }

      this.logger.error(
        `Webhook ${endpointId} failed after ${RETRY_DELAYS_MS.length} attempts: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}
