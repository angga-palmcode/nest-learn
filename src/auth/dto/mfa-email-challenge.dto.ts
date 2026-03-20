import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MfaEmailChallengeDto {
  @ApiProperty({ description: 'Short-lived mfa_pending JWT returned by /auth/login' })
  @IsString()
  mfa_token: string;

  @ApiProperty({ example: '482910', description: '6-digit OTP sent to your email' })
  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  code: string;
}
