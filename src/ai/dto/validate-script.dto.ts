import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ValidateScriptDto {
  @ApiProperty({ description: 'Campaign script with {variable} placeholders' })
  @IsString()
  script: string;
}
