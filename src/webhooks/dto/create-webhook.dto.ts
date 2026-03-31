import { ArrayMinSize, IsArray, IsString, IsUrl, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const VALID_EVENTS = [
  'call.started',
  'call.completed',
  'call.failed',
  'lead.updated',
  'lead.converted',
  'campaign.activated',
  'campaign.paused',
  'campaign.completed',
];

export class CreateWebhookDto {
  @ApiProperty({ example: 'https://example.com/webhooks/astos' })
  @IsUrl({ protocols: ['https'], require_tld: true })
  url: string;

  @ApiProperty({
    type: [String],
    example: ['call.completed', 'lead.converted'],
    description: `Valid events: ${VALID_EVENTS.join(', ')}`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^(call|lead|campaign)\.\w+$/, { each: true })
  events: string[];
}
