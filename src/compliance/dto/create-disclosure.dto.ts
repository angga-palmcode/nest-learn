import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateDisclosureDto {
  @ApiProperty({ example: 'Swedish Default' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'sv', description: 'Language code (sv, en)' })
  @IsString()
  language: string;

  @ApiProperty({ example: 'Detta samtal kan komma att spelas in...' })
  @IsString()
  text: string;

  @ApiProperty({ example: 'https://storage.example.com/disclosures/sv-default.mp3' })
  @IsString()
  audio_url: string;

  @ApiProperty({ example: 4500, description: 'Audio duration in milliseconds' })
  @IsInt()
  @Min(1)
  duration_ms: number;

  @ApiProperty({ example: 'SE', description: 'Jurisdiction code (SE, NO, etc.)' })
  @IsString()
  jurisdiction: string;

  @ApiPropertyOptional({ example: false, description: 'Set as default for this org + jurisdiction + language' })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
