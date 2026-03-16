import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new BadRequestException('An organization with this slug already exists');
    }

    return this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        industry: dto.industry,
        timezone: dto.timezone,
        locale: dto.locale,
      },
    });
  }

  findBySlug(slug: string) {
    return this.prisma.organization.findUnique({ where: { slug } });
  }
}
