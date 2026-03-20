import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PERMISSIONS } from '../auth/permissions';
import { ComplianceService } from './compliance.service';
import { AddDncDto } from './dto/add-dnc.dto';
import { CreateDisclosureDto } from './dto/create-disclosure.dto';
import { QueryComplianceAuditDto } from './dto/query-compliance-audit.dto';
import { RecordConsentDto } from './dto/record-consent.dto';
import { UpdateDisclosureDto } from './dto/update-disclosure.dto';

@ApiTags('compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  // ─── Consent ──────────────────────────────────────────────────────────────

  @Post('consent')
  @Roles(...PERMISSIONS.COMPLIANCE_CONSENT_WRITE)
  @ApiOperation({ summary: 'Record consent for a lead (admin, manager)' })
  @ApiResponse({ status: 201, description: 'Consent record created' })
  async recordConsent(@Request() req: any, @Body() dto: RecordConsentDto) {
    return this.complianceService.recordConsent(req.user.orgId, req.user.userId, dto);
  }

  @Get('consent/:lead_id')
  @Roles(...PERMISSIONS.COMPLIANCE_CONSENT_WRITE)
  @ApiOperation({ summary: 'Get consent history for a lead (admin, manager)' })
  @ApiResponse({ status: 200, description: 'List of consent records for the lead' })
  async getConsent(@Request() req: any, @Param('lead_id') leadId: string) {
    return this.complianceService.getConsent(req.user.orgId, leadId);
  }

  // ─── DNC ──────────────────────────────────────────────────────────────────

  @Get('dnc/check/:phone_number')
  @Roles(...PERMISSIONS.COMPLIANCE_DNC_READ)
  @ApiOperation({ summary: 'Check if a phone number is on the DNC registry (all roles)' })
  @ApiResponse({ status: 200, description: 'DNC status for the phone number' })
  async checkDnc(@Request() req: any, @Param('phone_number') phoneNumber: string) {
    return this.complianceService.checkDnc(req.user.orgId, phoneNumber);
  }

  @Post('dnc')
  @Roles(...PERMISSIONS.COMPLIANCE_DNC_WRITE)
  @ApiOperation({ summary: 'Manually add a phone number to the DNC registry (admin, manager)' })
  @ApiResponse({ status: 201, description: 'DNC entry created' })
  async addDnc(@Request() req: any, @Body() dto: AddDncDto) {
    return this.complianceService.addDnc(req.user.orgId, req.user.userId, dto);
  }

  @Post('dnc/sync')
  @Roles(...PERMISSIONS.COMPLIANCE_DNC_SYNC)
  @ApiOperation({ summary: 'Trigger DNC registry sync from national provider (admin only)' })
  @ApiResponse({ status: 201, description: 'Sync initiated' })
  async syncDnc(@Request() req: any) {
    return this.complianceService.syncDnc(req.user.orgId, req.user.userId);
  }

  // ─── Recording Disclosures ─────────────────────────────────────────────────

  @Get('disclosures')
  @Roles(...PERMISSIONS.COMPLIANCE_DISCLOSURES_READ)
  @ApiOperation({ summary: 'List all recording disclosures for the org (admin, manager)' })
  @ApiResponse({ status: 200, description: 'List of disclosures' })
  async listDisclosures(@Request() req: any) {
    return this.complianceService.listDisclosures(req.user.orgId);
  }

  @Post('disclosures')
  @Roles(...PERMISSIONS.COMPLIANCE_DISCLOSURES_WRITE)
  @ApiOperation({ summary: 'Create a recording disclosure (admin, manager)' })
  @ApiResponse({ status: 201, description: 'Disclosure created' })
  async createDisclosure(@Request() req: any, @Body() dto: CreateDisclosureDto) {
    return this.complianceService.createDisclosure(req.user.orgId, dto);
  }

  @Put('disclosures/:id')
  @Roles(...PERMISSIONS.COMPLIANCE_DISCLOSURES_WRITE)
  @ApiOperation({ summary: 'Update a recording disclosure (admin, manager)' })
  @ApiResponse({ status: 200, description: 'Disclosure updated' })
  @ApiResponse({ status: 404, description: 'Disclosure not found' })
  async updateDisclosure(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDisclosureDto,
  ) {
    return this.complianceService.updateDisclosure(req.user.orgId, id, dto);
  }

  // ─── Audit ────────────────────────────────────────────────────────────────

  @Get('audit')
  @Roles(...PERMISSIONS.COMPLIANCE_AUDIT_READ)
  @ApiOperation({ summary: 'Query compliance audit trail (admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated compliance checks' })
  async queryAudit(@Request() req: any, @Query() query: QueryComplianceAuditDto) {
    return this.complianceService.queryAudit(req.user.orgId, query);
  }

  @Get('audit/export')
  @Roles(...PERMISSIONS.COMPLIANCE_AUDIT_EXPORT)
  @ApiOperation({ summary: 'Export compliance audit trail as CSV (admin only)' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportAudit(
    @Request() req: any,
    @Query() query: QueryComplianceAuditDto,
    @Res() res: Response,
  ) {
    const csv = await this.complianceService.exportAuditCsv(req.user.orgId, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="compliance-audit.csv"');
    res.send(csv);
  }
}
