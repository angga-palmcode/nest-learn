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

  sendMfaEmailOtp(email: string, code: string): void {
    this.logger.log(`[MAIL] MFA email OTP → ${email} | Code: ${code}`);
  }

  sendDemoRequestNotification(data: {
    id: string;
    company_name: string;
    contact_name: string;
    email: string;
    phone?: string;
    industry?: string;
    message?: string;
  }): void {
    this.logger.log(`[MAIL] Demo request notification → sales team`);
    this.logger.log(`[MAIL] From: ${data.contact_name} <${data.email}> @ ${data.company_name} | industry: ${data.industry ?? 'n/a'} | id: ${data.id}`);
  }

  sendDemoRequestConfirmation(data: {
    contact_name: string;
    email: string;
    locale: string;
  }): void {
    this.logger.log(`[MAIL] Demo request confirmation → ${data.email} (locale: ${data.locale})`);
  }
}
