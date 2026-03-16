import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LogAuditParams {
  orgId: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogAuditParams): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        org_id: params.orgId,
        user_id: params.userId ?? null,
        action: params.action,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        metadata: params.metadata !== undefined ? (params.metadata as object) : undefined,
        ip_address: params.ipAddress ?? null,
      },
    });
  }
}
