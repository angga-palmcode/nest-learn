export interface CallResult {
  providerCallId: string;
  status: string;
}

export interface ProviderCallStatus {
  providerCallId: string;
  status: string;
  duration?: number;
}

export interface ITelephonyProvider {
  placeCall(from: string, to: string, options: Record<string, any>): Promise<CallResult>;
  hangUp(providerCallId: string): Promise<void>;
  getCallStatus(providerCallId: string): Promise<ProviderCallStatus>;
  startRecording(providerCallId: string): Promise<string>;
  stopRecording(providerCallId: string): Promise<void>;
  playAudio(providerCallId: string, audioUrl: string): Promise<void>;
  sendDTMF(providerCallId: string, digits: string): Promise<void>;
  transferCall(providerCallId: string, toNumber: string): Promise<void>;
}
