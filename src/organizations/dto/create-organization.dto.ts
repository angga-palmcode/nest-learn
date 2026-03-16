import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Collections', minLength: 2 })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'acme', description: 'Lowercase letters, numbers and hyphens only' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase letters, numbers and hyphens only',
  })
  slug: string;

  @ApiPropertyOptional({ enum: ['debt_collection', 'insurance', 'banking', 'healthcare'], example: 'debt_collection' })
  @IsOptional()
  @IsString()
  @IsIn(['debt_collection', 'insurance', 'banking', 'healthcare'])
  industry?: string;

  @ApiPropertyOptional({ example: 'Europe/Stockholm' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'sv' })
  @IsOptional()
  @IsString()
  locale?: string;
}
