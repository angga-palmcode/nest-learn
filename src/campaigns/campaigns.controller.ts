import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PERMISSIONS } from '../auth/permissions';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsDto } from './dto/list-campaigns.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  @Post()
  @Roles(...PERMISSIONS.CAMPAIGNS_WRITE)
  @ApiOperation({ summary: 'Create a campaign (admin, manager)' })
  @ApiResponse({ status: 201, description: 'Campaign created' })
  create(@Request() req: any, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.create(req.user.orgId, req.user.userId, dto);
  }

  @Get()
  @Roles(...PERMISSIONS.CAMPAIGNS_READ)
  @ApiOperation({ summary: 'List campaigns with filters (admin, manager)' })
  list(@Request() req: any, @Query() query: ListCampaignsDto) {
    return this.campaignsService.list(req.user.orgId, query);
  }

  @Get(':id')
  @Roles(...PERMISSIONS.CAMPAIGNS_READ)
  @ApiOperation({ summary: 'Get campaign details (admin, manager)' })
  @ApiResponse({ status: 404, description: 'Campaign not found' })
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.findOne(req.user.orgId, id);
  }

  @Put(':id')
  @Roles(...PERMISSIONS.CAMPAIGNS_WRITE)
  @ApiOperation({ summary: 'Update campaign — only allowed when draft or paused (admin, manager)' })
  @ApiResponse({ status: 400, description: 'Campaign is not in draft or paused status' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignsService.update(req.user.orgId, id, req.user.userId, dto);
  }

  @Delete(':id')
  @Roles(...PERMISSIONS.CAMPAIGNS_DELETE)
  @ApiOperation({ summary: 'Soft-delete campaign — only allowed when draft or completed (admin)' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.remove(req.user.orgId, id, req.user.userId);
  }

  // ─── Campaign Actions ──────────────────────────────────────────────────────

  @Post(':id/activate')
  @Roles(...PERMISSIONS.CAMPAIGNS_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate campaign (admin, manager). Requires ≥1 lead and valid disclosure.' })
  @ApiResponse({ status: 400, description: 'Precondition failed' })
  activate(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.activate(req.user.orgId, id, req.user.userId);
  }

  @Post(':id/pause')
  @Roles(...PERMISSIONS.CAMPAIGNS_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause an active campaign (admin, manager)' })
  pause(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.pause(req.user.orgId, id, req.user.userId);
  }

  @Post(':id/resume')
  @Roles(...PERMISSIONS.CAMPAIGNS_WRITE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused campaign (admin, manager)' })
  resume(@Request() req: any, @Param('id') id: string) {
    return this.campaignsService.resume(req.user.orgId, id, req.user.userId);
  }

  // ─── Lead Upload ───────────────────────────────────────────────────────────

  @Post(':id/leads/upload')
  @Roles(...PERMISSIONS.CAMPAIGNS_LEADS_UPLOAD)
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload leads CSV (admin, manager). Returns 202 + upload_id for status polling.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        field_mapping: { type: 'string', example: '{"name":"column_0","phone":"column_1"}' },
        skip_first_row: { type: 'string', example: 'true' },
      },
    },
  })
  uploadLeads(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('field_mapping') fieldMapping: string,
    @Body('skip_first_row') skipFirstRow: string,
  ) {
    return this.campaignsService.uploadLeads(
      req.user.orgId,
      id,
      req.user.userId,
      file,
      fieldMapping,
      skipFirstRow === 'true',
    );
  }

  @Get(':id/leads/uploads/:upload_id')
  @Roles(...PERMISSIONS.CAMPAIGNS_READ)
  @ApiOperation({ summary: 'Get lead upload status (admin, manager)' })
  @ApiResponse({ status: 404, description: 'Upload not found' })
  getUploadStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Param('upload_id') uploadId: string,
  ) {
    return this.campaignsService.getUploadStatus(req.user.orgId, id, uploadId);
  }
}
