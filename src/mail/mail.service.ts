import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:5173');
  }

  sendVerificationEmail(email: string, userId: string, hash: string): void {
    const url = `${this.frontendUrl}/auth/verify-email/${userId}/${hash}`;
    this.logger.log(`[MAIL] Verification email → ${email}`);
    this.logger.log(`[MAIL] Verify URL: ${url}`);
  }

  sendPasswordResetEmail(email: string, token: string): void {
    const url = `${this.frontendUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
    this.logger.log(`[MAIL] Password reset email → ${email}`);
    this.logger.log(`[MAIL] Reset URL: ${url}`);
  }

  sendInvitationEmail(email: string, token: string, inviterName: string, orgName: string): void {
    const url = `${this.frontendUrl}/auth/accept-invite?token=${token}`;
    this.logger.log(`[MAIL] Invitation email → ${email} (invited by ${inviterName} to ${orgName})`);
    this.logger.log(`[MAIL] Accept URL: ${url}`);
  }

  sendPasswordChangedEmail(email: string): void {
    this.logger.log(`[MAIL] Password changed confirmation → ${email}`);
  }

  sendAccountLockedEmail(email: string, lockedUntil: Date): void {
    this.logger.log(`[MAIL] Account locked notification → ${email} until ${lockedUntil.toISOString()}`);
  }
}
