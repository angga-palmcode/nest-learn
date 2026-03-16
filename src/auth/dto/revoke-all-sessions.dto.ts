import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RevokeAllSessionsDto {
  @ApiProperty({ example: 'CurrentP@ss123' })
  @IsString()
  current_password: string;
}
