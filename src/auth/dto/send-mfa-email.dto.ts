import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SendMfaEmailDto {
  @ApiProperty({ description: 'Short-lived mfa_pending JWT returned by /auth/login' })
  @IsString()
  mfa_token: string;
}
