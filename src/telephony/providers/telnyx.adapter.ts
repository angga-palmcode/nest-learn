import { Injectable, Logger } from '@nestjs/common';
import { CallResult, ITelephonyProvider, ProviderCallStatus } from './telephony-provider.interface';

@Injectable()
export class TelnyxAdapter implements ITelephonyProvider {
  private readonly logger = new Logger(TelnyxAdapter.name);

  async placeCall(from: string, to: string, _options: Record<string, any>): Promise<CallResult> {
    this.logger.log(`[Telnyx] Placing call ${from} → ${to}`);
    // TODO: integrate Telnyx SDK — npm install telnyx
    throw new Error('Telnyx integration not yet implemented');
  }

  async hangUp(providerCallId: string): Promise<void> {
    this.logger.log(`[Telnyx] Hanging up ${providerCallId}`);
    throw new Error('Telnyx integration not yet implemented');
  }

  async getCallStatus(providerCallId: string): Promise<ProviderCallStatus> {
    this.logger.log(`[Telnyx] Getting status for ${providerCallId}`);
    throw new Error('Telnyx integration not yet implemented');
  }

  async startRecording(providerCallId: string): Promise<string> {
    this.logger.log(`[Telnyx] Starting recording for ${providerCallId}`);
    throw new Error('Telnyx integration not yet implemented');
  }

  async stopRecording(providerCallId: string): Promise<void> {
    this.logger.log(`[Telnyx] Stopping recording for ${providerCallId}`);
    throw new Error('Telnyx integration not yet implemented');
  }

  async playAudio(providerCallId: string, audioUrl: string): Promise<void> {
    this.logger.log(`[Telnyx] Playing audio on ${providerCallId}: ${audioUrl}`);
    throw new Error('Telnyx integration not yet implemented');
  }

  async sendDTMF(providerCallId: string, digits: string): Promise<void> {
    this.logger.log(`[Telnyx] Sending DTMF ${digits} on ${providerCallId}`);
    throw new Error('Telnyx integration not yet implemented');
  }

  async transferCall(providerCallId: string, toNumber: string): Promise<void> {
    this.logger.log(`[Telnyx] Transferring ${providerCallId} to ${toNumber}`);
    throw new Error('Telnyx integration not yet implemented');
  }
}
