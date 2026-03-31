import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListCallsDto {
  @ApiPropertyOptional({ description: 'Filter by campaign ID' })
  @IsOptional()
  @IsString()
  campaign_id?: string;

  @ApiPropertyOptional({ description: 'Filter by lead ID' })
  @IsOptional()
  @IsString()
  lead_id?: string;

  @ApiPropertyOptional({ description: 'Comma-separated statuses: queued,ringing,answered,completed,failed,no_answer,busy,voicemail,cancelled' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Comma-separated intent results: interested,not_interested,callback_requested,dnc_requested,undetermined' })
  @IsOptional()
  @IsString()
  intent_result?: string;

  @ApiPropertyOptional({ description: 'Filter calls started on or after this date (ISO 8601)' })
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter calls started on or before this date (ISO 8601)' })
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Sort field with optional - prefix for descending. Allowed: started_at, ended_at, duration_seconds, status, intent_result' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: 'Comma-separated relations to include. Allowed: complianceChecks' })
  @IsOptional()
  @IsString()
  include?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  page_size?: number = 50;
}
