import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryComplianceAuditDto {
  @ApiPropertyOptional({ description: 'Filter by call ID (exact)' })
  @IsOptional()
  @IsString()
  call_id?: string;

  @ApiPropertyOptional({ description: 'Filter by lead ID (exact)' })
  @IsOptional()
  @IsString()
  lead_id?: string;

  @ApiPropertyOptional({
    example: 'consent,dnc',
    description: 'Comma-separated check types: consent, dnc, calling_window, recording_disclosure, optout_detection',
  })
  @IsOptional()
  @IsString()
  check_type?: string;

  @ApiPropertyOptional({
    example: 'passed,failed',
    description: 'Comma-separated statuses: passed, failed, skipped',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-03-01', description: 'Filter checked_at >= date' })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-03-31', description: 'Filter checked_at <= date' })
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional({
    example: '-created_at',
    description: 'Sort field. Prefix with - for descending. Allowed: created_at, check_type, status',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50, description: 'Max 50' })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(50)
  page_size?: number;
}
