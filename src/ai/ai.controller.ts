import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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
import { AiService } from './ai.service';
import { ValidateScriptDto } from './dto/validate-script.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('voices')
  @Roles(...PERMISSIONS.AI_VOICES_READ)
  @ApiOperation({ summary: 'List available TTS voices (all roles)' })
  listVoices() {
    return this.aiService.listVoices();
  }

  @Get('voices/:id/preview')
  @Roles(...PERMISSIONS.AI_VOICES_READ)
  @ApiOperation({ summary: 'Get 10-second audio preview of a voice (all roles)' })
  @ApiResponse({ status: 404, description: 'Voice not found' })
  getVoicePreview(@Param('id') id: string) {
    return this.aiService.getVoicePreview(id);
  }

  @Post('scripts/validate')
  @Roles(...PERMISSIONS.AI_SCRIPTS_VALIDATE)
  @ApiOperation({ summary: 'Validate a campaign script — checks variables and estimates token count (admin, manager)' })
  validateScript(@Body() dto: ValidateScriptDto) {
    return this.aiService.validateScript(dto.script);
  }
}
