import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { LeadsService } from './leads.service';
import { ListLeadsDto } from './dto/list-leads.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns/:campaign_id/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @Roles(...PERMISSIONS.LEADS_READ)
  @ApiOperation({ summary: 'List leads for a campaign' })
  @ApiParam({ name: 'campaign_id', type: String })
  list(
    @Req() req: any,
    @Param('campaign_id') campaignId: string,
    @Query() query: ListLeadsDto,
  ) {
    return this.leadsService.listLeads(req.user.orgId, campaignId, query);
  }

  @Get('export')
  @Roles(...PERMISSIONS.LEADS_EXPORT)
  @ApiOperation({ summary: 'Export leads as CSV' })
  @ApiParam({ name: 'campaign_id', type: String })
  async export(
    @Req() req: any,
    @Param('campaign_id') campaignId: string,
    @Query() query: ListLeadsDto,
    @Res() res: Response,
  ) {
    return this.leadsService.exportLeadsCsv(req.user.orgId, campaignId, query, res);
  }

  @Get(':id')
  @Roles(...PERMISSIONS.LEADS_READ)
  @ApiOperation({ summary: 'Get a single lead with call history' })
  @ApiParam({ name: 'campaign_id', type: String })
  @ApiParam({ name: 'id', type: String })
  findOne(
    @Req() req: any,
    @Param('campaign_id') campaignId: string,
    @Param('id') id: string,
  ) {
    return this.leadsService.getLead(req.user.orgId, campaignId, id);
  }

  @Put(':id')
  @Roles(...PERMISSIONS.LEADS_WRITE)
  @ApiOperation({ summary: 'Update a lead (status, callback info)' })
  @ApiParam({ name: 'campaign_id', type: String })
  @ApiParam({ name: 'id', type: String })
  update(
    @Req() req: any,
    @Param('campaign_id') campaignId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.updateLead(req.user.orgId, campaignId, id, req.user.userId, dto);
  }
}
