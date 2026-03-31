import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TelnyxAdapter } from './providers/telnyx.adapter';
import { TwilioAdapter } from './providers/twilio.adapter';
import { TelephonyController } from './telephony.controller';
import { TelephonyService } from './telephony.service';

@Module({
  imports: [PrismaModule, ComplianceModule],
  controllers: [TelephonyController],
  providers: [TelephonyService, TelnyxAdapter, TwilioAdapter],
  exports: [TelephonyService],
})
export class TelephonyModule {}
