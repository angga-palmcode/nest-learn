import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MfaRecoverDto {
  @ApiProperty({ description: 'Short-lived mfa_pending JWT returned by /auth/login' })
  @IsString()
  mfa_token: string;

  @ApiProperty({ example: 'a1b2c3d4', description: '8-char hex recovery code (single-use)' })
  @IsString()
  recovery_code: string;
}
