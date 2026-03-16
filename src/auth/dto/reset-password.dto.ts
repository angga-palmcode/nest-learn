import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ example: 'erik@company.se' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'NewSecureP@ss456', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'NewSecureP@ss456' })
  @IsString()
  password_confirmation: string;
}
