import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class RecordConsentDto {
  @ApiProperty({ example: 'a1b2c3d4-...', description: 'Lead UUID' })
  @IsUUID()
  lead_id: string;

  @ApiProperty({ enum: ['prior_express', 'prior_express_written', 'implied'] })
  @IsIn(['prior_express', 'prior_express_written', 'implied'])
  consent_type: string;

  @ApiProperty({ example: 'web_form', description: 'Where consent was obtained' })
  @IsString()
  consent_source: string;

  @ApiPropertyOptional({ example: 'I agree to be contacted by phone regarding my account.' })
  @IsOptional()
  @IsString()
  consent_text?: string;

  @ApiProperty({ example: '2026-02-15T10:00:00Z' })
  @IsDateString()
  consented_at: string;

  @ApiPropertyOptional({ example: '2027-02-15T10:00:00Z', description: 'NULL = no expiry' })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}
