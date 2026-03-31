import { IsIn, IsISO8601, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const WRITABLE_STATUSES = [
  'new', 'queued', 'calling', 'contacted', 'interested',
  'not_interested', 'converted', 'callback_scheduled', 'failed',
] as const;

export class UpdateLeadDto {
  @ApiPropertyOptional({
    enum: WRITABLE_STATUSES,
    description: 'Cannot change status to/from "dnc" or "max_attempts_reached" via this endpoint',
  })
  @IsOptional()
  @IsIn(WRITABLE_STATUSES)
  status?: (typeof WRITABLE_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  callback_notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  next_call_at?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  callback_requested_at?: string;
}
