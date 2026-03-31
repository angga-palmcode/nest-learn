import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
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
import { ListCallsDto } from './dto/list-calls.dto';
import { TelephonyService } from './telephony.service';

@ApiTags('calls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calls')
export class TelephonyController {
  constructor(private readonly telephonyService: TelephonyService) {}

  @Get()
  @Roles(...PERMISSIONS.CALLS_READ)
  @ApiOperation({ summary: 'List calls with filters (admin, manager)' })
  @ApiResponse({ status: 200, description: 'Paginated list of calls' })
  async listCalls(@Request() req: any, @Query() query: ListCallsDto) {
    return this.telephonyService.listCalls(req.user.orgId, query);
  }

  @Get(':id')
  @Roles(...PERMISSIONS.CALLS_READ)
  @ApiOperation({ summary: 'Get call details including compliance checks (admin, manager)' })
  @ApiResponse({ status: 200, description: 'Call details' })
  @ApiResponse({ status: 404, description: 'Call not found' })
  async getCall(@Request() req: any, @Param('id') id: string) {
    return this.telephonyService.getCall(req.user.orgId, id);
  }

  @Get(':id/recording')
  @Roles(...PERMISSIONS.CALLS_RECORDING)
  @ApiOperation({ summary: 'Get pre-signed recording URL valid for 1 hour (admin, manager)' })
  @ApiResponse({ status: 200, description: 'Pre-signed recording URL + expiry' })
  @ApiResponse({ status: 404, description: 'Call or recording not found' })
  async getCallRecording(@Request() req: any, @Param('id') id: string) {
    return this.telephonyService.getCallRecording(req.user.orgId, id);
  }

  @Get(':id/transcript')
  @Roles(...PERMISSIONS.CALLS_READ)
  @ApiOperation({ summary: 'Get call transcript (admin, manager)' })
  @ApiResponse({ status: 200, description: 'Call transcript' })
  @ApiResponse({ status: 404, description: 'Call or transcript not found' })
  async getCallTranscript(@Request() req: any, @Param('id') id: string) {
    return this.telephonyService.getCallTranscript(req.user.orgId, id);
  }
}
