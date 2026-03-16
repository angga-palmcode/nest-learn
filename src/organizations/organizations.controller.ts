import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new tenant organisation' })
  @ApiResponse({ status: 201, description: 'Organisation created' })
  @ApiResponse({ status: 400, description: 'Slug already taken or validation error' })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get organisation by slug' })
  @ApiResponse({ status: 200, description: 'Organisation found' })
  @ApiResponse({ status: 404, description: 'Organisation not found' })
  findOne(@Param('slug') slug: string) {
    return this.organizationsService.findBySlug(slug);
  }
}
