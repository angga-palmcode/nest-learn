import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ListUsersDto {
  @ApiPropertyOptional({ example: 'manager', enum: ['admin', 'manager', 'agent'] })
  @IsOptional()
  @IsIn(['admin', 'manager', 'agent'])
  role?: string;

  @ApiPropertyOptional({ example: 'erik', description: 'Partial match on name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'true', description: 'Filter by active/inactive status' })
  @IsOptional()
  @IsString()
  is_active?: string;

  @ApiPropertyOptional({ example: 'created_at', enum: ['name', 'email', 'role', 'created_at', 'last_login_at'] })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page_size?: number;
}
