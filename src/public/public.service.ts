import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { DemoRequestDto } from './dto/demo-request.dto';

@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async submitDemoRequest(dto: DemoRequestDto, ipAddress: string | undefined) {
    const record = await this.prisma.demoRequest.create({
      data: {
        company_name: dto.company_name,
        contact_name: dto.contact_name,
        email:        dto.email,
        phone:        dto.phone ?? null,
        industry:     dto.industry ?? null,
        message:      dto.message ?? null,
        locale:       dto.locale ?? 'sv',
        ip_address:   ipAddress ?? null,
      },
    });

    // Internal sales notification
    await this.mail.sendDemoRequestNotification({
      id:           record.id,
      company_name: record.company_name,
      contact_name: record.contact_name,
      email:        record.email,
      phone:        record.phone ?? undefined,
      industry:     record.industry ?? undefined,
      message:      record.message ?? undefined,
    });

    // Requester confirmation
    await this.mail.sendDemoRequestConfirmation({
      contact_name: record.contact_name,
      email:        record.email,
      locale:       record.locale,
    });

    return { message: 'Demo request received' };
  }
}
