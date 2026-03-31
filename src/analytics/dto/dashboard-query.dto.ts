import { IsISO8601, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DashboardQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601). Defaults to today.' })
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601). Defaults to today.' })
  @IsOptional()
  @IsISO8601()
  date_to?: string;
}
