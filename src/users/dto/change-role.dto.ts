import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class ChangeRoleDto {
  @ApiProperty({ enum: ['admin', 'manager', 'agent'], example: 'agent' })
  @IsIn(['admin', 'manager', 'agent'])
  role: 'admin' | 'manager' | 'agent';
}
