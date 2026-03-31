import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service';
import { DemoRequestDto } from './dto/demo-request.dto';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Post('demo-request')
  @HttpCode(201)
  @Throttle({ default: { ttl: 3_600_000, limit: 5 } })
  @ApiOperation({ summary: 'Submit a demo request (public — no auth required)' })
  submitDemoRequest(@Body() dto: DemoRequestDto, @Ip() ip: string) {
    return this.publicService.submitDemoRequest(dto, ip);
  }
}
