import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MfaChallengeDto {
  @ApiProperty({ description: 'Short-lived mfa_pending JWT returned by /auth/login' })
  @IsString()
  mfa_token: string;

  @ApiProperty({ example: '123456', description: '6-digit TOTP code from your authenticator app' })
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  code: string;
}
