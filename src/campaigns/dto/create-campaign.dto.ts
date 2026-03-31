import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  script: string;

  @ApiProperty()
  @IsString()
  voice_id: string;

  @ApiPropertyOptional({ default: 'sv' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({ description: 'Outbound caller ID in E.164 format' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'caller_id must be a valid E.164 phone number' })
  caller_id: string;

  @ApiProperty({ description: 'UUID of the RecordingDisclosure to play' })
  @IsUUID()
  disclosure_id: string;

  @ApiPropertyOptional({ default: 'Europe/Stockholm' })
  @IsOptional()
  @IsString()
  schedule_timezone?: string;

  @ApiProperty({ example: '09:00', description: 'HH:MM format' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'schedule_start_time must be HH:MM' })
  schedule_start_time: string;

  @ApiProperty({ example: '17:00', description: 'HH:MM format' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'schedule_end_time must be HH:MM' })
  schedule_end_time: string;

  @ApiProperty({ example: [1, 2, 3, 4, 5], description: 'Weekdays: 1=Mon, 7=Sun' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  @Type(() => Number)
  schedule_days: number[];

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  max_concurrent_calls?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  max_attempts_per_lead?: number;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  retry_interval_minutes?: number;

  @ApiPropertyOptional({ enum: ['hang_up', 'leave_message', 'retry_later'], default: 'hang_up' })
  @IsOptional()
  @IsIn(['hang_up', 'leave_message', 'retry_later'])
  amd_action?: string;

  @ApiPropertyOptional({ description: 'Required when amd_action = leave_message' })
  @IsOptional()
  @IsString()
  voicemail_script?: string;
}
