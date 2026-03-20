import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AddDncDto {
  @ApiProperty({ example: '+46701234567', description: 'E.164 format phone number' })
  @IsString()
  phone_number: string;

  @ApiPropertyOptional({ example: 'Customer requested removal' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'Associated lead ID if applicable' })
  @IsOptional()
  @IsString()
  lead_id?: string;
}
