import { IsEmail, IsIn, IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const INDUSTRIES = ['debt_collection', 'insurance', 'banking', 'healthcare', 'other'] as const;

export class DemoRequestDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  company_name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  contact_name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: INDUSTRIES })
  @IsOptional()
  @IsIn(INDUSTRIES)
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ default: 'sv' })
  @IsOptional()
  @IsIn(['sv', 'en'])
  locale?: string;
}
