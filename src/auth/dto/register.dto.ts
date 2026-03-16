import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Erik Johansson' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'erik@company.se' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecureP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  password_confirmation: string;

  @ApiProperty({ example: 'Stockholm Collections AB' })
  @IsString()
  @IsNotEmpty()
  organization_name: string;

  @ApiPropertyOptional({ example: 'debt_collection', enum: ['debt_collection', 'insurance', 'banking', 'healthcare', 'other'] })
  @IsOptional()
  @IsIn(['debt_collection', 'insurance', 'banking', 'healthcare', 'other'])
  industry?: string;

  @ApiPropertyOptional({ example: 'sv', enum: ['sv', 'en'] })
  @IsOptional()
  @IsIn(['sv', 'en'])
  locale?: string;
}
