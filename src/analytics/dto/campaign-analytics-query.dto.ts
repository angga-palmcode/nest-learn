import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CampaignAnalyticsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  date_to?: string;

  @ApiPropertyOptional({ enum: ['hour', 'day', 'week', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['hour', 'day', 'week', 'month'])
  granularity?: 'hour' | 'day' | 'week' | 'month';
}
