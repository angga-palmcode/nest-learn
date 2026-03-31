import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListCampaignsDto {
  @ApiPropertyOptional({ description: 'Comma-separated statuses: draft,active,paused,completed,archived' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Partial match on name and description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort field with optional - for descending. Allowed: name, status, created_at, updated_at' })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: 'Comma-separated includes. Allowed: leadStats' })
  @IsOptional()
  @IsString()
  include?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 25, maximum: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  page_size?: number = 25;
}
