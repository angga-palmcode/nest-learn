import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PERMISSIONS } from '../auth/permissions';
import { AnalyticsService } from './analytics.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { CampaignAnalyticsQueryDto } from './dto/campaign-analytics-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(...PERMISSIONS.ANALYTICS_READ)
  @ApiOperation({ summary: 'Main dashboard summary — active campaigns, calls today, conversions, hourly chart' })
  getDashboard(@Req() req: any, @Query() query: DashboardQueryDto) {
    return this.analyticsService.getDashboard(req.user.orgId, query);
  }

  @Get('campaigns/:id')
  @Roles(...PERMISSIONS.ANALYTICS_READ)
  @ApiOperation({ summary: 'Campaign analytics — summary, funnel, intent distribution, calls over time' })
  @ApiParam({ name: 'id', type: String })
  getCampaignAnalytics(
    @Req() req: any,
    @Param('id') id: string,
    @Query() query: CampaignAnalyticsQueryDto,
  ) {
    return this.analyticsService.getCampaignAnalytics(req.user.orgId, id, query);
  }
}
