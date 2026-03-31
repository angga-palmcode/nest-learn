import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post()
  @Roles(...PERMISSIONS.WEBHOOKS_WRITE)
  @ApiOperation({ summary: 'Register a webhook endpoint' })
  create(@Req() req: any, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(req.user.orgId, req.user.userId, dto);
  }

  @Get()
  @Roles(...PERMISSIONS.WEBHOOKS_READ)
  @ApiOperation({ summary: 'List webhook endpoints for the org' })
  list(@Req() req: any) {
    return this.webhooksService.list(req.user.orgId);
  }

  @Get(':id')
  @Roles(...PERMISSIONS.WEBHOOKS_READ)
  @ApiOperation({ summary: 'Get a webhook endpoint' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.webhooksService.findOne(req.user.orgId, id);
  }

  @Put(':id')
  @Roles(...PERMISSIONS.WEBHOOKS_WRITE)
  @ApiOperation({ summary: 'Update a webhook endpoint' })
  @ApiParam({ name: 'id', type: String })
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.webhooksService.update(req.user.orgId, id, req.user.userId, dto);
  }

  @Delete(':id')
  @Roles(...PERMISSIONS.WEBHOOKS_WRITE)
  @ApiOperation({ summary: 'Delete a webhook endpoint' })
  @ApiParam({ name: 'id', type: String })
  remove(@Req() req: any, @Param('id') id: string) {
    return this.webhooksService.remove(req.user.orgId, id, req.user.userId);
  }

  @Post(':id/rotate-secret')
  @Roles(...PERMISSIONS.WEBHOOKS_WRITE)
  @ApiOperation({ summary: 'Rotate the signing secret for a webhook endpoint' })
  @ApiParam({ name: 'id', type: String })
  rotateSecret(@Req() req: any, @Param('id') id: string) {
    return this.webhooksService.rotateSecret(req.user.orgId, id, req.user.userId);
  }
}
