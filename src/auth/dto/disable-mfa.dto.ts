import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DisableMfaDto {
  @ApiProperty({ example: 'CurrentP@ss123' })
  @IsString()
  current_password: string;

  @ApiProperty({ example: '123456', description: 'Current TOTP code from authenticator app' })
  @IsString()
  code: string;
}
