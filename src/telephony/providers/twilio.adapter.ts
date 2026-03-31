import { Injectable, Logger } from '@nestjs/common';
import { CallResult, ITelephonyProvider, ProviderCallStatus } from './telephony-provider.interface';

@Injectable()
export class TwilioAdapter implements ITelephonyProvider {
  private readonly logger = new Logger(TwilioAdapter.name);

  async placeCall(from: string, to: string, _options: Record<string, any>): Promise<CallResult> {
    this.logger.log(`[Twilio] Placing call ${from} → ${to}`);
    // TODO: integrate Twilio SDK — npm install twilio
    throw new Error('Twilio integration not yet implemented');
  }

  async hangUp(providerCallId: string): Promise<void> {
    this.logger.log(`[Twilio] Hanging up ${providerCallId}`);
    throw new Error('Twilio integration not yet implemented');
  }

  async getCallStatus(providerCallId: string): Promise<ProviderCallStatus> {
    this.logger.log(`[Twilio] Getting status for ${providerCallId}`);
    throw new Error('Twilio integration not yet implemented');
  }

  async startRecording(providerCallId: string): Promise<string> {
    this.logger.log(`[Twilio] Starting recording for ${providerCallId}`);
    throw new Error('Twilio integration not yet implemented');
  }

  async stopRecording(providerCallId: string): Promise<void> {
    this.logger.log(`[Twilio] Stopping recording for ${providerCallId}`);
    throw new Error('Twilio integration not yet implemented');
  }

  async playAudio(providerCallId: string, audioUrl: string): Promise<void> {
    this.logger.log(`[Twilio] Playing audio on ${providerCallId}: ${audioUrl}`);
    throw new Error('Twilio integration not yet implemented');
  }

  async sendDTMF(providerCallId: string, digits: string): Promise<void> {
    this.logger.log(`[Twilio] Sending DTMF ${digits} on ${providerCallId}`);
    throw new Error('Twilio integration not yet implemented');
  }

  async transferCall(providerCallId: string, toNumber: string): Promise<void> {
    this.logger.log(`[Twilio] Transferring ${providerCallId} to ${toNumber}`);
    throw new Error('Twilio integration not yet implemented');
  }
}
