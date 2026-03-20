import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({ example: 'a1b2c3d4...64-char-hex-token' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'Erik Johansson' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ example: 'SecureP@ss123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'SecureP@ss123' })
  @IsString()
  password_confirmation: string;
}
