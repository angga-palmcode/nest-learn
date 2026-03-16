import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class InviteUserDto {
  @ApiProperty({ example: 'anna@company.se' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['admin', 'manager', 'agent'], example: 'manager' })
  @IsIn(['admin', 'manager', 'agent'])
  role: 'admin' | 'manager' | 'agent';

  @ApiPropertyOptional({ example: 'Anna Lindgren' })
  @IsOptional()
  @IsString()
  name?: string;
}
